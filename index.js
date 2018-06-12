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

bot.telegram.sendMessage(process.env.chat_id, '*Starting...*', {
	parse_mode: 'Markdown'
})
console.log('Starting...')

bot.use((ctx, next) => {
	data.usedTotal++
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

bot.command('stats', (ctx) => {
	var totalDeStickes = data.stickers.length
	var usedTotal = data.usedTotal
	ctx.replyWithMarkdown(`
*Total de Stickers:* ${totalDeStickes}
*Total de consultas:* ${usedTotal}
	`)
})

bot.catch((err) => {
	console.log(`Oooops ${err}`)
})

bot.on(['sticker', 'message'], (ctx) => {
	var msg = ctx.message
	var text = 'Veja o /help'
	var options = {}
	console.log(ctx.message)
	console.log(msg.chat && msg.chat.type && msg.chat.type != 'private')
	if (msg.chat && msg.chat.type && msg.chat.type != 'private') {
		return
	} else if (msg.reply_to_message && msg.reply_to_message.text) {
		var textOfReply = msg.reply_to_message.text
		if (textOfReply.match('StickerID:')) {
			var stickerId = textOfReply.replace(/StickerID:/i, '').replace(/\n.*/, '')
			var serieName = msg.text.toString().toLowerCase().replace(/\s/g, '').replace(/\n/g, '')
			text = `StickerID:${stickerId}\nAgora é buscavel por: ${serieName}`
			data.stickers.push({
				name: serieName.split('').toString().replace(/,/g, ' '),
				id: `${stickerId}`,
				user: msg.from.id.toString()
			})
			jsonfile.writeFileSync(file, data, {replacer: true})
			search.addDocuments(data.stickers)
		}
	} else if (msg.sticker && msg.sticker.file_id) {
		text = `StickerID:${msg.sticker.file_id}\nQual é o nome da série?`
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
	} else if (series.length <= 20) {
		series.forEach(serie => {
			console.log(serie)
			result.push({
				type: 'sticker',
				id: `${serie.id}`,
				sticker_file_id: `${serie.id}`
			})
		})
	} else {
		result.push({
			type: 'article',
			title: 'Carregando...',
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
