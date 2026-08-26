const express = require('express');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

// Archivo JSON donde guardaremos las fechas
const DATA_FILE = path.join(__dirname, 'fechas.json');

// Función para cargar fechas
function cargarFechas() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
    }
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    try {
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

// Función para guardar fechas
function guardarFechas(fechas) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(fechas, null, 2));
}

// Servidor web simple para Render
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('Calendario-Bot activo y guardando fechas xD');
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
            .setDescription('Hora del evento, ej. 15:30 (Opcional)')
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
});

// Función para revisar eventos automáticamente cada minuto
function iniciarVerificadorFechas() {
    setInterval(() => {
        const ahora = new Date();
        const diaActual = ahora.getDate();
        const mesActual = ahora.getMonth() + 1; // Enero es 0
        const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

        const listaFechas = cargarFechas();

        listaFechas.forEach(evento => {
            // Comparamos día y mes
            if (evento.dia === diaActual && evento.mes === mesActual) {
                // Si guardó una hora específica, validamos que coincida, si no, avisa a las 8:00 AM por defecto o cuando coincida
                console.log(`¡Hoy es el evento de ${evento.nombre}! :v`);
                
                // Nota: Aquí después configuraremos el canal exacto de Discord para que mande el mensaje público.
            }
        });
    }, 60000); // Se ejecuta cada 60,000 ms (1 minuto)
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'apuntar') {
        const nombre = interaction.options.getString('nombre');
        const tipo = interaction.options.getString('tipo');
        const dia = interaction.options.getInteger('dia');
        const mes = interaction.options.getInteger('mes');
        const anio = interaction.options.getInteger('anio') || null;
        const hora = interaction.options.getString('hora') || 'Todo el día';
        const autor = interaction.user.tag;

        // Cargar, agregar y guardar en el JSON
        const listaFechas = cargarFechas();
        listaFechas.push({
            nombre,
            tipo,
            dia,
            mes,
            anio,
            hora,
            creadoPor: autor
        });
        guardarFechas(listaFechas);

        await interaction.reply(`¡Anotado de a deveras en el mapa! Evento **"${nombre}"** [**${tipo}**] guardado para el ${dia}/${mes}/${anio ? anio : 'Sin año'} a las ${hora}. ¡Pásele a cobrarle al Mancomelette sus 500 lucas de mentira! > < :v`);
    }
});

client.login(process.env.DISCORD_TOKEN);
                                                  
