const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');
const express = require('express'); // Aki agregamos express pal render prro > < :v

// Mini servidor web pa ke Render no crashe el bot
const app = express();
app.get('/', (req, res) => res.send('El bot de Pepo ta despierto prro > < :v'));
app.listen(process.env.PORT || 3000, () => console.log('Servidor web encendido para Render :v'));

// Configuración del cliente de Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Conexión a MongoDB Atlas (Asegúrate de tener tu variable de entorno configurada)
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('¡Conectado a MongoDB con éxito! > < :v'))
    .catch(err => console.error('Error al conectar a MongoDB:', err));

// Esquema y Modelo de Mongoose para los Eventos
const eventoSchema = new mongoose.Schema({
    nombre: String,
    tipo: String,
    fecha: String,
    hora: String,
    userId: String
});

const Evento = mongoose.model('Evento', eventoSchema);

// Registro de comandos de barra (Slash Commands)
const commands = [
    new SlashCommandBuilder()
        .setName('apuntar')
        .setDescription('Anota un nuevo evento en el calendario')
        .addStringOption(option => 
            option.setName('nombre').setDescription('Nombre del evento').setRequired(true))
        .addStringOption(option => 
            option.setName('tipo').setDescription('Tipo de evento (ej. cumple)').setRequired(true))
        .addStringOption(option => 
            option.setName('fecha').setDescription('Fecha del evento').setRequired(true)),

    new SlashCommandBuilder()
        .setName('listar')
        .setDescription('Muestra todos los eventos guardados en la base de datos'),

    new SlashCommandBuilder()
        .setName('borrar')
        .setDescription('Borra un evento por su nombre')
        .addStringOption(option => 
            option.setName('nombre').setDescription('Nombre exacto del evento a borrar').setRequired(true)),

    new SlashCommandBuilder()
        .setName('editar')
        .setDescription('Modifica un evento existente en la base de datos')
        .addStringOption(option => 
            option.setName('nombre_actual').setDescription('Nombre actual del evento que quieres cambiar').setRequired(true))
        .addStringOption(option => 
            option.setName('nuevo_nombre').setDescription('Nuevo nombre para el evento (opcional)').setRequired(false))
        .addStringOption(option => 
            option.setName('nueva_fecha').setDescription('Nueva fecha para el evento (opcional)').setRequired(false))
].map(command => command.toJSON());

// Configuración del REST pa registrar los comandos en Discord
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
    console.log(`¡Bot encendido y listo como ${client.user.tag}! > < :v`);
    
    // Aki le avisamos a Discord de los comandos nuebos
    try {
        console.log('Actualisando comandos de barra en Discord...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('¡Comandos actualisados al 100! > < :v');
    } catch (error) {
        console.error(error);
    }
});

// Manejador de interacciones para los comandos
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // Comando: /apuntar (intacto komo me pediste)
    if (commandName === 'apuntar') {
        const nombre = interaction.options.getString('nombre');
        const tipo = interaction.options.getString('tipo');
        const fecha = interaction.options.getString('fecha');

        await interaction.deferReply({ flags: 64 }).catch(() => {});

        try {
            const nuevoEvento = new Evento({ nombre, tipo, fecha, userId: interaction.user.id });
            await nuevoEvento.save();
            await interaction.editReply(`¡Anotado y guardado en la nube! Evento "${nombre}" [${tipo}] para el ${fecha}. > < :v`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('¡Chale, tronó la base de datos al guardar! > < :v');
        }
    }

    // Comando: /listar (intacto)
    else if (commandName === 'listar') {
        await interaction.deferReply({ flags: 64 }).catch(() => {});

        try {
            const eventos = await Evento.find();
            if (eventos.length === 0) {
                await interaction.editReply('No hay ningún evento registrado en la base de datos todavía. > < :v');
                return;
            }

            let listaTexto = '📅 **Eventos en la base de datos:**\n';
            eventos.forEach((ev, index) => {
                listaTexto += `${index + 1}. **${ev.nombre}** [${ev.tipo}] - Fecha: ${ev.fecha}\n`;
            });

            await interaction.editReply(listaTexto);
        } catch (error) {
            console.error(error);
            await interaction.editReply('¡Chale, no se pudo cargar la lista desde la nube! > < :v');
        }
    }

    // Comando: /borrar (intacto)
    else if (commandName === 'borrar') {
        const nombreBajar = interaction.options.getString('nombre');

        await interaction.deferReply({ flags: 64 }).catch(() => {});

        try {
            const resultado = await Evento.findOneAndDelete({ nombre: nombreBajar });
            if (!resultado) {
                await interaction.editReply(`¡Nel, no encontré ningún evento llamado "${nombreBajar}"! > < :v`);
            } else {
                await interaction.editReply(`¡Evento "${nombreBajar}" mandado directo a la basura con éxito! 🗑️ > < :v`);
            }
        } catch (error) {
            console.error(error);
            await interaction.editReply('¡Chale, tronó la base de datos al borrar! > < :v');
        }
    }

    // Comando: /editar (el bueno pa q jale)
    else if (commandName === 'editar') {
        const nombreViejo = interaction.options.getString('nombre_actual');
        const nuevoNombre = interaction.options.getString('nuevo_nombre');
        const nuevaFecha = interaction.options.getString('nueva_fecha');

        await interaction.deferReply({ flags: 64 }).catch(() => {});

        try {
            const camposActualizados = {};
            if (nuevoNombre) camposActualizados.nombre = nuevoNombre;
            if (nuevaFecha) camposActualizados.fecha = nuevaFecha;

            const eventoActualizado = await Evento.findOneAndUpdate(
                { nombre: nombreViejo },
                { $set: camposActualizados },
                { new: true }
            );

            if (!eventoActualizado) {
                await interaction.editReply(`¡Nel, no encontré ningún evento llamado "${nombreViejo}" en la base de datos! > < :v`);
            } else {
                await interaction.editReply(`¡Éxito! El evento fue actualizado correctamente en la nube. > < :v`);
            }
        } catch (error) {
            console.error(error);
            await interaction.editReply('¡Chale, tronó la base de datos al intentar editar el evento! > < :v');
        }
    }
});

// Inicia sesión en Discord con tu token
client.login(process.env.DISCORD_TOKEN);

