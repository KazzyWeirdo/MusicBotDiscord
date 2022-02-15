const Discord = require("discord.js");
const { prefix, token } = require("./config.json");
const ytdl = require("ytdl-core");

const client = new Discord.Client({autoReconnect:true});

const queue = new Map();

client.once("ready", () => {
	console.log("Ready!");
});

client.once("reconnecting", () => {
	console.log("Reconnecting!");
});

client.once("disconnect", () => {
	console.log("Disconnect!");
});

client.on("message", async message => {
	if (message.author.bot) return;
	if (!message.content.startsWith(prefix)) return;

	const serverQueue = queue.get(message.guild.id);

	if (message.content.startsWith(`${prefix}play`)) {
		const validator = validateYouTubeUrl(message.content.replace('?play', '').trim());
		if(validator == true){
			execute(message, serverQueue);
			return;
		} else {
			message.channel.send("¡Tienes que poner un link valido!");
		}

	} else if (message.content.startsWith(`${prefix}skip`)) {
		skip(message, serverQueue);
		return;
	} else if (message.content.startsWith(`${prefix}stop`)) {
		stop(message, serverQueue);
		return;
	} else if (message.content.startsWith(`${prefix}help`)) {
		message.channel.send("Lista de comandos:\n?play {link}: Reproduce musica a través de un link de Youtube.\n?stop: Para la música que esté reproduciendo el bot.\n?skip: Salta a la siguiente música que esté en la lista de espera.");
	} else {
		message.channel.send("¡Tienes que poner un comando valido!");
	}
});

function validateYouTubeUrl(urlToParse){
	if (urlToParse) {
		console.log(urlToParse)
		const regExp = /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/;
		if (urlToParse.match(regExp)) {
			return true;
		}
	}
	return false;
}

async function execute(message, serverQueue) {
	const args = message.content.split(" ");

	const voiceChannel = message.member.voice.channel;
	if (!voiceChannel)
		return message.channel.send(
			"¡Necesitas estar en un canal de voz para reproducir música!"
		);
	const permissions = voiceChannel.permissionsFor(message.client.user);
	if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
		return message.channel.send(
			"¡Necesito permisos para poder entrar en el canal de voz!"
		);
	}

	const songInfo = await ytdl.getInfo(args[1]);
	const song = {
		title: songInfo.videoDetails.title,
		url: songInfo.videoDetails.video_url,
	};

	if (!serverQueue) {
		const queueContruct = {
			textChannel: message.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 5,
			playing: true
		};

		queue.set(message.guild.id, queueContruct);

		queueContruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueContruct.connection = connection;
			play(message.guild, queueContruct.songs[0]);
		} catch (err) {
			console.log(err);
			queue.delete(message.guild.id);
			return message.channel.send(err);
		}
	} else {
		serverQueue.songs.push(song);
		return message.channel.send(`¡${song.title} se ha añadido a la lista de espera!`);
	}
}

function skip(message, serverQueue) {
	if (!message.member.voice.channel)
		return message.channel.send(
			"¡Necesitas estar en un canal de voz para poder saltar de música!"
		);
	if (!serverQueue)
		return message.channel.send("¡No hay ninguna canción la cual pueda saltar!");
	serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
	if (!message.member.voice.channel)
		return message.channel.send(
			"¡Necesitas estar en un canal de voz para poder parar musica!"
		);

	if (!serverQueue)
		return message.channel.send("¡No hay ninguna canción para poder parar!");

	serverQueue.songs = [];
	serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);
	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}

	const dispatcher = serverQueue.connection
		.play(ytdl(song.url, {quality: 'highestaudio'}))
		.on("finish", () => {
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
		})
		.on("error", (error) => {
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
			console.error(error);
		})
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
	serverQueue.textChannel.send(`Reproduciendo: **${song.title}**`);
}

client.on('shardError', error => {
	console.error('A websocket connection encountered an error:', error);
});

client.login(token);