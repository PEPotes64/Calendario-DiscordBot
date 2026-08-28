const express = require('express');
const mongoose = require('mongoose');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

// Conexión a MongoDB (Lee la URL desde las variables de entorno de Render)
const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
    console.error("¡FALTA LA VARIABLE MONGO_URL EN RENDER! Configúrala para guardar los datos. > < :v");
}

mongoose.connect(MONGO_URL)
    .then(() => console.log('¡Conectado a MongoDB Atlas con éxito! :v'))
    .catch(err => console.error('Error al conectar a MongoDB:', err));

// Definir el esquema y modelo de los eventos en la base de datos
const eventoSchema = new mongoose.Schema({
    nombre: String,
    tipo: String,
    dia: Number,
    mes: Number,
    anio: Number,
    hora: String,
    creadoPor: String,
    avisado: Boolean
});

const Evento = mongoose.model('Evento', eventoSchema);

// ID del rol Staff autorizado para borrar eventos
const ROL_AUTORIZADO_ID = '1398485777511350312'; 

// Servidor web simple para mantener activo el servicio en Render
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', async (req, res) => {
    try {
        const total = await Evento.countDocuments();
        res.send(`Calendario-Bot activo con MongoDB. Eventos guardados: ${total} xD`);
    } catch (e) {
        res.send('Calendario-Bot activo, pero con problemas al contar la BD.');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor HTTP en puerto ${PORT}`);
});

// Configuración del cliente de Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Definición de los comandos de barra (/apuntar, /borrar y /listar)
const apuntarCommand = new SlashCommandBuilder()
    .setName('apuntar')
    .setDescription('Guarda una fecha importante en el calendario del server')
    .addStringOption(option =>
        option.setName('nombre')
            .setDescription('Nombre del evento o cumple')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('tipo')
            .setDescription('Selecciona el tipo de evento')
            .setRequired(true)
            .addChoices(
                { name: 'Cumpleaños', value: 'cumple' },
                { name: 'Salida de un medio de entretenimiento', value: 'entretenimiento' },
                { name: 'Aniversario', value: 'aniversario' }
            ))
    .addIntegerOption(option =>
        option.setName('dia')
            .setDescription('Día del mes (1-31)')
            .setRequired(true))
    .addIntegerOption(option =>
        option.setName('mes')
            .setDescription('Mes del año (1-12)')
            .setRequired(true))
    .addIntegerOption(option =>
        option.setName('anio')
            .setDescription('Año (Opcional)')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('hora')
            .setDescription('Hora del evento, ej. 18:30 (Opcional)')
            .setRequired(false));

const borrarCommand = new SlashCommandBuilder()
    .setName('borrar')
    .setDescription('Borra un evento guardado por su nombre (Requiere rol Staff)')
    .addStringOption(option =>
        option.setName('nombre')
            .setDescription('Nombre exacto del evento a eliminar')
            .setRequired(true));

const listarCommand = new SlashCommandBuilder()
    .setName('listar')
    .setDescription('Muestra todos los eventos guardados actualmente en el bot');

client.once('ready', async () => {
    console.log(`¡Calendario-Bot conectado como ${client.user.tag}!`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Registrando comandos de barra (/) ...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: [apuntarCommand.toJSON(), borrarCommand.toJSON(), listarCommand.toJSON()] },
        );
        console.log('¡Comandos de barra registrados al centavo! :v');
    } catch (error) {
        console.error('Error al registrar comandos:', error);
    }

    iniciarVerificadorFechas();
});

// Verificador ajustado a la hora exacta de Guatemala (America/Guatemala) con MongoDB
function iniciarVerificadorFechas() {
    setInterval(async () => {
        try {
            const opcionesFecha = { timeZone: 'America/Guatemala', hour12: false };
            const ahoraGuatemala = new Date();
            
            const diaActual = parseInt(ahoraGuatemala.toLocaleString('en-US', { ...opcionesFecha, day: 'numeric' }));
            const mesActual = parseInt(ahoraGuatemala.toLocaleString('en-US', { ...opcionesFecha, month: 'numeric' }));
            const horaActual = ahoraGuatemala.toLocaleString('en-US', { ...opcionesFecha, hour: '2-digit', minute: '2-digit' }).replace(/\s/g, '');

            const eventosHoy = await Evento.find({ dia: diaActual, mes: mesActual, hora: horaActual, avisado: false });

            for (const evento of eventosHoy) {
                evento.avisado = true;
                await evento.save();

                client.guilds.cache.forEach(async (guild) => {
                    const canal = guild.channels.cache.find(c => c.isTextBased() && (c.name.includes('general') || c.name.includes('comandos') || c.name.includes('calendario')));
                    if (canal) {
                        await canal.send(`🚨 **¡ES HOY!** 🚨\n¡Son las ${horaActual} y hoy es: **"${evento.nombre}"** [Tipo: *${evento.tipo}*]! 🎉 > < :v`);
                    }
                });
            }
        } catch (e) {
            console.error("Error en el verificador de fechas:", e);
        }
    }, 30000);
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply({ flags: 64 }).catch(() => {});

    // Comando /apuntar
    if (interaction.commandName === 'apuntar') {
        const nombre = interaction.options.getString('nombre');
        const tipo = interaction.options.getString('tipo');
        const dia = interaction.options.getInteger('dia');
        const mes = interaction.options.getInteger('mes');
        const anio = interaction.options.getInteger('anio') || null;
        const hora = interaction.options.getString('hora') || '08:00';
        const autor = interaction.user.tag;

        try {
            const nuevoEvento = new Evento({
                nombre,
                tipo,
                dia,
                mes,
                anio,
                hora,
                creadoPor: autor,
                avisado: false
            });

            await nuevoEvento.save();

            await interaction.editReply(`¡Anotado y guardado en la nube! Evento **"${nombre}"** [**${tipo}**] para el ${dia}/${mes}/${anio ? anio : 'Sin año'} a las ${hora}. > < :v`);
        } catch (e) {
            console.error(e);
            await interaction.editReply('Hubo un error al guardar el evento en la base de datos. 💀');
        }
    }

    // Comando /listar
    if (interaction.commandName === 'listar') {
        try {
            const listaFechas = await Evento.find();

            if (listaFechas.length === 0) {
                return await interaction.editReply('No hay ningún evento registrado en la nube ahora mismo. 🧐');
            }

            let descripcion = listaFechas.map((ev, index) => 
                `**${index + 1}.** ${ev.nombre} [${ev.tipo}] - Fecha: ${ev.dia}/${ev.mes}/${ev.anio || 'Sin año'} a las ${ev.hora}`
            ).join('\n');

            await interaction.editReply(`📅 **Eventos en la base de datos:**\n${descripcion}`);
        } catch (e) {
            console.error(e);
            await interaction.editReply('Error al consultar los eventos. 💀');
        }
    }

    // Comando /borrar (Protegido para Staff)
    if (interaction.commandName === 'borrar') {
        const miembro = interaction.member;
        
        if (!miembro.roles.cache.has(ROL_AUTORIZADO_ID)) {
            return await interaction.editReply('¡Nel, perro! No tienes el rol de Staff autorizado para borrar eventos. 🛑 > < :v');
        }

        const nombreABorrar = interaction.options.getString('nombre').trim();

        try {
            const resultado = await Evento.findOneAndDelete({ 
                nombre: { $regex: new RegExp(`^${nombreABorrar}$`, 'i') } 
            });

            if (resultado) {
                await interaction.editReply(`¡Evento **"${resultado.nombre}"** mandado directo a la basura con éxito! 🗑️ > < :v`);
            } else {
                await interaction.editReply(`No encontré ningún evento con ese nombre exacto. Usa el comando \`/listar\` para ver los nombres tal cual están guardados. 🧐`);
            }
        } catch (e) {
            console.error(e);
            await interaction.editReply('Error al intentar borrar el evento. 💀');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
                                              
