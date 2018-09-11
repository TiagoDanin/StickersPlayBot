const Telegraf = require('telegraf')
const jsonfile = require('jsonfile')
const JsSearch = require('js-search')

const file = 'data.json'
var data = jsonfile.readFileSync(file)

var search = new JsSearch.Search('id')
search.addIndex('name')
search.addIndex('id')
search.addDocuments(data.stickers)

var help = `*Bem-vindo(a)*
🤖 @StickersPlayBot
👤 Criado por Tiago Danin (@TiagoEDGE).
👥 Com ajuda da comunidade para cadastrar os stickers.

📕 Para cadastrar um sticker, mande ele em meu privado e depois o nome da série (sem abreviação e sem tradução).
📗 Para buscar user o modo inline \`@StickersPlayBot nome da série\`.
`

const token = process.env.telegram_token
const bot = new Telegraf(token)

function checkStickers(id) {
	for (sticker of data.stickers) {
		if (sticker.id.includes(id)) {
			return false
		}
	}
	return true
}

bot.telegram.sendMessage(process.env.chat_id, '*Starting...*', {
	parse_mode: 'Markdown'
})
console.log('Starting...')

bot.use((ctx, next) => {
	console.log('\n------------')
	data.usedTotal++
	console.log('Used ~>', data.usedTotal)
	next()
})

bot.command('ping', (ctx) => {
	ctx.replyWithMarkdown('*Pong*!')
})

bot.command('start', (ctx) => {
	ctx.replyWithMarkdown(help)
})

bot.command('help', (ctx) => {
	ctx.replyWithMarkdown(help)
})

bot.command('ajuda', (ctx) => {
	ctx.replyWithMarkdown(help)
})

bot.command('about', (ctx) => {
	ctx.replyWithMarkdown(help)
})

bot.command('sobre', (ctx) => {
	ctx.replyWithMarkdown(help)
})

bot.command('backup', (ctx) => {
	ctx.replyWithDocument({ source: 'data.json' })
})

bot.hears(/^\/pack (.*)/i, (ctx) => {
	var name = ctx.match[1]
	var chatId = ctx.chat.id
	bot.telegram.getStickerSet(name).then(async update => {
		ctx.reply('Vou começar a manda stickes sem nome!')
		for (sticker of update.stickers) {
			var stickerId = sticker.file_id
			if (checkStickers(stickerId)) {
				await bot.telegram.sendSticker(chatId, stickerId).then(async msg => {
					await bot.telegram.sendMessage(chatId, `StickerID:${stickerId}\nQual é o nome da série?`, {
						reply_to_message_id: msg.message_id
					})
				})
			}
		}
		ctx.reply('Feito!')
	}).catch(e => {
		console.log(e)
		ctx.reply('Não conheço um pack com esse nome!')
	})
})

bot.command('stats', (ctx) => {
	var totalDeStickes = data.stickers.length
	var usedTotal = data.usedTotal
	var totalDeColab = data.stickers
		.map(sticker => sticker.user)
		.sort()
		.reduce((_, next) => {
			if (_.__proto__ != new Array(0).__proto__) {
				_ = [_]
			}
			if (!_.includes(next)) {
				_.push(next)
			}
			return _
		})
		.length
	ctx.replyWithMarkdown(`
*~> stats*
*Total de Stickers:* ${totalDeStickes}
*Total de Consultas:* ${usedTotal}
*Total de Colaboradores:* ${totalDeColab}
	`)
})

bot.catch((err) => {
	console.log(`Oooops ${err}`)
})

bot.on(['sticker', 'message'], (ctx) => {
	var msg = ctx.message
	var text = 'Veja o /help'
	var options = {}
	if (msg.chat && msg.chat.type && msg.chat.type != 'private') {
		return
	} else if (msg.reply_to_message && msg.reply_to_message.text) {
		var textOfReply = msg.reply_to_message.text
		var match = textOfReply.match('StickerID:(.+)\n')
		if (match) {
			var stickerId = match[1]
			console.log('Sticker ~>', stickerId)
			var serieName = msg.text.toString().toLowerCase().replace(/\s/g, '').replace(/\n/g, '')
			text = `StickerID:${stickerId}`
			if (!checkStickers(stickerId)) {
				text += `\n‼️ Sugestão: ${serieName} foi enviado para @TiagoEDGE.`
				var avisoTexto = `#Aviso\nID:${stickerId}`
				avisoTexto += `\nUser: ${msg.from.id}`
				if (msg.from.username) {
					avisoTexto += `\nUsername: @${msg.from.username}`
				}
				var serie = search.search(stickerId.toString())
				if (serie.length != 0) {
					avisoTexto += `\nAtual: ${serie[0].name.replace(/\s/g, '')}`
				}
				avisoTexto += `\nSugestão: ${serieName}`
				bot.telegram.sendMessage(
					process.env.chat_id,
					avisoTexto
				)
			} else {
				text += `\nAgora é buscavel por: ${serieName}`
			}
			data.stickers.push({
				name: serieName.split('').toString().replace(/,/g, ' '),
				id: `${stickerId}`,
				user: msg.from.id.toString()
			})
			console.log('SerieName ~>', serieName)
			jsonfile.writeFileSync(file, data, {replacer: true})
			search.addDocuments(data.stickers)
		}
	} else if (msg.sticker && msg.sticker.file_id) {
		var stickerId = msg.sticker.file_id
		console.log('Input Sticker ~>', stickerId)
		text = `StickerID:${stickerId}\nQual é o nome da série?`
		if (!checkStickers(stickerId)) {
			text += '\n\nJá achei esse sticker no meu bando de dados!'
			var serie = search.search(stickerId.toString())
			if (serie.length != 0) {
				text += `\nSeu nome de busca atual é: ${serie[0].name.replace(/\s/g, '')}\n`
			}
			text += '\n‼️ Você pode enviar um novo nome, um moderador vai escolher o melhor.'
		}
		options = {
			reply_markup: {
				force_reply: true
			}
		}
	}
	return ctx.reply(text, options)
})

bot.on('inline_query', (ctx) => {
	var result = []
	var name = ctx.update.inline_query.query
		.toString()
		.toLowerCase()
		.replace(/\s/g, '')
		.replace(/\n/g, '')
		.split('')
		.toString()
		.replace(/,/g, ' ')
	console.log('Inline Query ~>', ctx.update.inline_query.query)
	var series = search.search(name)
	if (series.length == 0) {
		result.push({
			type: 'article',
			title: 'Série não encontrada! Mande um sticker dessa série em meu privado.',
			id: 'notfound',
			input_message_content: {
				message_text: 'Série não encontrada, caso tenha um sticker dessa série mande em meu privado :)'
			}
		})
	} else if (series.length <= 40) {
		series.forEach(serie => {
			result.push({
				type: 'sticker',
				id: `${serie.id}`,
				sticker_file_id: `${serie.id}`
			})
		})
	} else {
		result.push({
			type: 'article',
			title: 'Achei mais de 40 Stickers. Continuie escrevendo o nome da série para eu exebir o correto...',
			id: 'loading',
			input_message_content: {
				message_text: 'Carregando...'
			}
		})
	}
	ctx.answerInlineQuery(result, {
		cache_time: 0
	})
})

bot.startPolling()
