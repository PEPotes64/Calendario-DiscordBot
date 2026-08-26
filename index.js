const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

// Memoria temporal del bot para que no se borre con los reinicios efímeros de Render
let listaFechas = [];

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

// Definición del comando /apuntar
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

client.once('ready', async () => {
    console.log(`¡Calendario-Bot conectado como ${client.user.tag}!`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Registrando comandos de barra (/) ...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: [apuntarCommand.toJSON()] },
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
        // Obtenemos la hora actual específica de Guatemala sin importar el servidor de Render
        const opcionesFecha = { timeZone: 'America/Guatemala', hour12: false };
        const ahoraGuatemala = new Date();
        
        const diaActual = parseInt(ahoraGuatemala.toLocaleString('en-US', { ...opcionesFecha, day: 'numeric' }));
        const mesActual = parseInt(ahoraGuatemala.toLocaleString('en-US', { ...opcionesFecha, month: 'numeric' }));
        
        const horaStr = ahoraGuatemala.toLocaleString('en-US', { ...opcionesFecha, hour: '2-digit', minute: '2-digit' });
        // Limpiamos formato de hora por si trae espacios
        const horaActual = horaStr.replace(/\s/g, '');

        listaFechas.forEach(async (evento) => {
            if (evento.dia === diaActual && evento.mes === mesActual && evento.hora === horaActual) {
                client.guilds.cache.forEach(async (guild) => {
                    const canal = guild.channels.cache.find(c => c.isTextBased() && (c.name.includes('general') || c.name.includes('comandos') || c.name.includes('calendario')));
                    if (canal) {
                        await canal.send(`🚨 **¡ALERTA DE CALENDARIO EXACTA!** 🚨\n¡Son las ${horaActual} y toca atender: **"${evento.nombre}"** [Tipo: *${evento.tipo}*]! 🎉 > < :v`);
                    }
                });
            }
        });
    }, 30000); // Revisa cada 30 segundos
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'apuntar') {
        const nombre = interaction.options.getString('nombre');
        const tipo = interaction.options.getString('tipo');
        const dia = interaction.options.getInteger('dia');
        const mes = interaction.options.getInteger('mes');
        const anio = interaction.options.getInteger('anio') || null;
        const hora = interaction.options.getString('hora') || '08:00';
        const autor = interaction.user.tag;

        // Guardamos directamente en el arreglo en memoria
        listaFechas.push({
            nombre,
            tipo,
            dia,
            mes,
            anio,
            hora,
            creadoPor: autor
        });

        console.log("Eventos actuales en memoria:", listaFechas);

        await interaction.reply(`¡Anotado en la memoria del bot! Evento **"${nombre}"** [**${tipo}**] guardado para el ${dia}/${mes}/${anio ? anio : 'Sin año'} a las ${hora}. > < :v`);
    }
});

client.login(process.env.DISCORD_TOKEN);
                                                                 
