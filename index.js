const express = require('express');
const mongoose = require('mongoose');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');

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

const proximoCommand = new SlashCommandBuilder()
    .setName('proximo')
    .setDescription('Muestra cuánto falta para el próximo evento o recuerdo guardado');

const recuerdoCommand = new ContextMenuCommandBuilder()
    .setName('recuerdo')
    .setType(ApplicationCommandType.Message);

const olvidarCommand = new ContextMenuCommandBuilder()
    .setName('olvidar')
    .setType(ApplicationCommandType.Message);

client.once('ready', async () => {
    console.log(`¡Calendario-Bot conectado como ${client.user.tag}!`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Registrando comandos de barra (/) ...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: [apuntarCommand.toJSON(), borrarCommand.toJSON(), listarCommand.toJSON(), proximoCommand.toJSON(), recuerdoCommand.toJSON(), olvidarCommand.toJSON()] }
            
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

client.on('interactionCreate', async interaction => {
    console.log("-> LLEGÓ UNA INTERACCIÓN:", interaction.commandName, "Es chat input?", interaction.isChatInputCommand(), "Es context menu?", interaction.isContextMenuCommand());

    if (interaction.commandName === 'recuerdo') {
        console.log("-> ¡SÍ ENTRÓ AL COMANDO RECUERDO!");
        await interaction.deferReply({ ephemeral: true }).catch(err => console.log("Error en defer:", err));

        const targetMessage = interaction.targetMessage;
        console.log("-> Mensaje objetivo obtenido:", targetMessage ? targetMessage.content : "NULO");

        if (!targetMessage) {
            return await interaction.editReply({ content: '¡Tienes que seleccionar un mensaje, perro! > < :v' });
        }

        const fechaOriginal = targetMessage.createdAt;
        const dia = fechaOriginal.getDate();
        const mes = fechaOriginal.getMonth() + 1;
        const ano = fechaOriginal.getFullYear();

        try {
            await Evento.create({
    nombre: targetMessage.content.substring(0, 50), // O el campo de nombre que prefieras
    tipo: 'Recuerdo',
    dia: dia,
    mes: mes,
    anio: ano,
    hora: '12:00', // O la hora que extraigas del mensaje
    creadoPor: targetMessage.author.tag,
    avisado: false
});

            return await interaction.editReply({ content: `¡Recuerdo guardado con éxito! Te lo recordaré cada ${dia}/${mes} > < :v` });
        } catch (error) {
            console.error("-> Error al guardar en mongo:", error);
            return await interaction.editReply({ content: '¡exploto la base de datos al guardar el recuerdo💀!' });
        }
    }
    
   if (interaction.commandName === 'olvidar') {
    const targetMessage = interaction.targetMessage;
    if (!targetMessage) {
        return await interaction.reply({ content: '¡Selecciona un mensaje válido!', flags: 64 });
    }

    try {
        const resultado = await Evento.findOneAndDelete({ 
            nombre: { $regex: new RegExp(targetMessage.content.substring(0, 30), 'i') } 
        });

        if (resultado) {
            return await interaction.reply({ content: `¡Evento o recuerdo "${resultado.nombre}" borrado con éxito del mapa! > < :v`, flags: 64 });
        } else {
            return await interaction.reply({ content: 'No encontré ningún registro en la base de datos que coincida con este mensaje :v', flags: 64 });
        }
    } catch (error) {
        console.error('Error al borrar de mongo:', error);
        return await interaction.reply({ content: '¡Exploto la base de datos al intentar olvidar el recuerdo💀!', flags: 64 });
    }
                }
    
    // 2. Filtro para los comandos de barra normales
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply({ flags: 64 }).catch(() => {});
    
    // ... aquí siguen tus otros comandos (/listar, /borrar, etc.)
    

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

    // Comando /proximo
if (interaction.commandName === 'proximo') {
    try {
        const ahora = new Date();
        const lista = await Evento.find();

        if (!lista || lista.length === 0) {
            return await interaction.editReply({ content: 'No hay ningún evento guardado en la nube todavía, paps :v' });
        }

        let eventoProximo = null;
        let menorDiferencia = Infinity;

        for (const ev of lista) {
            const anioEv = ev.anio || ahora.getFullYear();
            const fechaEv = new Date(anioEv, ev.mes - 1, ev.dia);
            const diferencia = fechaEv.getTime() - ahora.getTime();

            if (diferencia >= 0 && diferencia < menorDiferencia) {
                menorDiferencia = diferencia;
                eventoProximo = ev;
            }
        }

        if (!eventoProximo) {
            return await interaction.editReply({ content: 'No encontré próximos eventos futuros en la base de datos :v' });
        }

        const diasFaltantes = Math.ceil(menorDiferencia / (1000 * 60 * 60 * 24));

        return await interaction.editReply({ 
            content: `⏳ El próximo evento es **"${eventoProximo.nombre}"** (${eventoProximo.tipo}) y faltan aproximadamente **${diasFaltantes} días** (${eventoProximo.dia}/${eventoProximo.mes}/${eventoProximo.anio || ahora.getFullYear()}) > < :v` 
        });

    } catch (error) {
        console.error('Error al calcular el próximo evento:', error);
        return await interaction.editReply({ content: '¡Exploto la base de datos al buscar el próximo evento💀!' });
    }
    }
    
});

client.login(process.env.DISCORD_TOKEN);
                                              
