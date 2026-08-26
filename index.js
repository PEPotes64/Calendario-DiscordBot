const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

// Memoria temporal del bot
let listaFechas = [];

// ID del rol Staff autorizado para borrar eventos
const ROL_AUTORIZADO_ID = '1398485777511350312'; 

// Servidor web simple para mantener activo el servicio en Render
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send(`Calendario-Bot activo. Eventos guardados en memoria: ${listaFechas.length} xD`);
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

// Definición de los comandos de barra (/apuntar y /borrar)
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

client.once('ready', async () => {
    console.log(`¡Calendario-Bot conectado como ${client.user.tag}!`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Registrando comandos de barra (/) ...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: [apuntarCommand.toJSON(), borrarCommand.toJSON()] },
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

    // Comando /apuntar (Cualquiera puede usarlo)
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

        await interaction.reply(`¡Anotado en la memoria del bot! Evento **"${nombre}"** [**${tipo}**] guardado para el ${dia}/${mes}/${anio ? anio : 'Sin año'} a las ${hora}. > < :v`);
    }

    // Comando /borrar (Protegido exclusivamente para el rol Staff)
    if (interaction.commandName === 'borrar') {
        const miembro = interaction.member;
        
        if (!miembro.roles.cache.has(ROL_AUTORIZADO_ID)) {
            return await interaction.reply({ content: '¡Nel, perro! No tienes el rol de Staff autorizado para borrar eventos del calendario. 🛑 > < :v', ephemeral: true });
        }

        const nombreABorrar = interaction.options.getString('nombre').trim().toLowerCase();
        const totalAntes = listaFechas.length;

        listaFechas = listaFechas.filter(evento => evento.nombre.trim().toLowerCase() !== nombreABorrar);

        if (listaFechas.length < totalAntes) {
            await interaction.reply(`¡Evento **"${interaction.options.getString('nombre')}"** mandado directo a la basura con éxito! 🗑️ > < :v`);
        } else {
            await interaction.reply({ content: `No encontré ningún evento registrado con el nombre **"${interaction.options.getString('nombre')}"**. Revisa bien cómo se escribe. 🧐`, ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
                        
