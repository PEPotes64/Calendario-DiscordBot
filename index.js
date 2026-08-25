const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

// Servidor web simple para que Render no tire error de puerto
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('Calendario-Bot activo y vigilando el tiempo xD');
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

// Definición del comando /apuntar con sus opciones
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
            .setDescription('Hora del evento, ej. 15:30 (Opcional)')
            .setRequired(false));

client.once('ready', async () => {
    console.log(`¡Calendario-Bot conectado como ${client.user.tag}!`);

    // Registro automático del slash command en Discord
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
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'apuntar') {
        const nombre = interaction.options.getString('nombre');
        const tipo = interaction.options.getString('tipo');
        const dia = interaction.options.getInteger('dia');
        const mes = interaction.options.getInteger('mes');
        const anio = interaction.options.getInteger('anio') || 'No especificado';
        const hora = interaction.options.getString('hora') || 'Todo el día';

        // Aquí luego metemos la lógica para guardarlo en un fechas.json
        await interaction.reply(`¡Anotado en el mapa! Evento **"${nombre}"** de tipo [**${tipo}**] guardado para el ${dia}/${mes}/${anio} a las ${hora}. > < :v`);
    }
});

client.login(process.env.DISCORD_TOKEN);
                                      
