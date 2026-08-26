const express = require('express');
const fs = require('fs');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const ARCHIVO_DATOS = './fechas.json';

// Cargar fechas desde el archivo JSON si existe, para sobrevivir a los reinicios de Render
let listaFechas = [];
if (fs.existsSync(ARCHIVO_DATOS)) {
    try {
        const datosGuardados = fs.readFileSync(ARCHIVO_DATOS, 'utf8');
        listaFechas = JSON.parse(datosGuardados);
        console.log(`¡Se cargaron ${listaFechas.length} eventos desde el archivo JSON! :v`);
    } catch (e) {
        console.error("Error al leer el archivo de datos:", e);
        listaFechas = [];
    }
}

// Función para guardar en el archivo JSON
function guardarFechas() {
    try {
        fs.writeFileSync(ARCHIVO_DATOS, JSON.stringify(listaFechas, null, 2), 'utf8');
    } catch (e) {
        console.error("Error al escribir el archivo de datos:", e);
    }
}

// ID del rol Staff autorizado para borrar eventos
const ROL_AUTORIZADO_ID = '1398485777511350312'; 

// Servidor web simple para mantener activo el servicio en Render
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send(`Calendario-Bot activo. Eventos guardados: ${listaFechas.length} xD`);
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

// Verificador ajustado a la hora exacta de Guatemala (America/Guatemala)
function iniciarVerificadorFechas() {
    setInterval(async () => {
        const opcionesFecha = { timeZone: 'America/Guatemala', hour12: false };
        const ahoraGuatemala = new Date();
        
        const diaActual = parseInt(ahoraGuatemala.toLocaleString('en-US', { ...opcionesFecha, day: 'numeric' }));
        const mesActual = parseInt(ahoraGuatemala.toLocaleString('en-US', { ...opcionesFecha, month: 'numeric' }));
        const horaActual = ahoraGuatemala.toLocaleString('en-US', { ...opcionesFecha, hour: '2-digit', minute: '2-digit' }).replace(/\s/g, '');

        listaFechas.forEach(async (evento) => {
            if (evento.dia === diaActual && evento.mes === mesActual && evento.hora === horaActual && !evento.avisado) {
                evento.avisado = true;
                guardarFechas(); // Actualizamos el archivo

                client.guilds.cache.forEach(async (guild) => {
                    const canal = guild.channels.cache.find(c => c.isTextBased() && (c.name.includes('general') || c.name.includes('comandos') || c.name.includes('calendario')));
                    if (canal) {
                        await canal.send(`🚨 **¡ES HOY!** 🚨\n¡Son las ${horaActual} y hoy es: **"${evento.nombre}"** [Tipo: *${evento.tipo}*]! 🎉 > < :v`);
                    }
                });
            }
        });
    }, 30000);
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Le damos más tiempo a Discord para que no marque error si el bot va despertando
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

        listaFechas.push({
            nombre,
            tipo,
            dia,
            mes,
            anio,
            hora,
            creadoPor: autor,
            avisado: false
        });

        guardarFechas();

        await interaction.editReply(`¡Anotado y respaldado! Evento **"${nombre}"** [**${tipo}**] guardado para el ${dia}/${mes}/${anio ? anio : 'Sin año'} a las ${hora}. > < :v`);
    }

    // Comando /listar
    if (interaction.commandName === 'listar') {
        if (listaFechas.length === 0) {
            return await interaction.editReply('No hay ningún evento registrado en la memoria ahora mismo. 🧐');
        }

        let descripcion = listaFechas.map((ev, index) => 
            `**${index + 1}.** ${ev.nombre} [${ev.tipo}] - Fecha: ${ev.dia}/${ev.mes}/${ev.anio || 'Sin año'} a las ${ev.hora}`
        ).join('\n');

        await interaction.editReply(`📅 **Eventos en la memoria del bot:**\n${descripcion}`);
    }

    // Comando /borrar (Protegido para Staff)
    if (interaction.commandName === 'borrar') {
        const miembro = interaction.member;
        
        if (!miembro.roles.cache.has(ROL_AUTORIZADO_ID)) {
            return await interaction.editReply('¡Nel, perro! No tienes el rol de Staff autorizado para borrar eventos. 🛑 > < :v');
        }

        const nombreABorrar = interaction.options.getString('nombre').trim().toLowerCase();
        const totalAntes = listaFechas.length;

        listaFechas = listaFechas.filter(evento => evento.nombre.trim().toLowerCase() !== nombreABorrar);

        if (listaFechas.length < totalAntes) {
            guardarFechas();
            await interaction.editReply(`¡Evento **"${interaction.options.getString('nombre')}"** mandado directo a la basura con éxito! 🗑️ > < :v`);
        } else {
            await interaction.editReply(`No encontré ningún evento con ese nombre exacto. Usa el comando \`/listar\` para ver los nombres tal cual están guardados. 🧐`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
    
