const Telegraf = require('telegraf')
const jsonfile = require('jsonfile')
const JsSearch = require('js-search')
const similarity = require('similarity')

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

🗣 [Canal de Atualizações & Log](https://t.me/${process.env.channel_link})

📕 Para cadastrar um sticker, mande ele em meu privado e depois o nome da série (sem abreviação e sem tradução).
📗 Para pesquisar user o modo inline \`@StickersPlayBot nome da série\`.
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

bot.command(['start', 'sobre', 'about', 'ajuda', 'help'], (ctx) => {
	ctx.replyWithMarkdown(help)
})

bot.command('backup', (ctx) => {
	ctx.replyWithMarkdown('#Backup')
	ctx.replyWithDocument({ source: 'Stickers.backup.JSON' })
})

bot.hears(/^\/pack (.*)/i, (ctx) => {
	var name = ctx.match[1]
	var chatId = ctx.chat.id
	bot.telegram.getStickerSet(name).then(async update => {
		ctx.reply('Vou começar a manda stickers sem nome!')
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
	var topUsers = {}
	var totalDeColab = data.stickers
		.map(sticker => sticker.user)
		.sort()
		.reduce((_, next) => {
			if (!_.includes(next)) {
				_.push(next)
			}
			topUsers[next] = topUsers[next] + 1 || 1
			return _
		}, [])
		.length

	topUsers = Object.keys(topUsers).sort((a, b) => topUsers[b] - topUsers[a])

	ctx.replyWithMarkdown(`
*~> stats*
*Total de Stickers:* ${totalDeStickes}
*Total de Consultas:* ${usedTotal}
*Total de Colaboradores:* ${totalDeColab}

*Top 5* de colaboradores (IDs):
*1.* - \`${topUsers[0]}\`
*2.* - \`${topUsers[1]}\`
*3.* - \`${topUsers[2]}\`
*4.* - \`${topUsers[3]}\`
*5.* - \`${topUsers[4]}\`
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
				bot.telegram.sendMessage(process.env.chat_id, avisoTexto, {
					reply_markup: {
						inline_keyboard:
						[
							[{text: '✅ Sim' , callback_data: `true:${stickerId}` }],
							[{text: '❌ Não' , callback_data: `false:${stickerId}` }]
						]
					}
				})
				data.sugestion.push({
					name: serieName.split('').toString().replace(/,/g, ' '),
					id: `${stickerId}`,
					user: msg.from.id.toString()
				})
			} else {
				text += `\nAgora é pesquisavel por: ${serieName}`
				data.stickers.push({
					name: serieName.split('').toString().replace(/,/g, ' '),
					id: `${stickerId}`,
					user: msg.from.id.toString()
				})

				bot.telegram.sendSticker(process.env.channel_id, stickerId)
				bot.telegram.sendMessage(process.env.channel_id, `
📌 *Sticker (Novo)*
Sticker ID: \`${stickerId}\`
Pesquisar ID: ${serieName.split('').toString().replace(/,/g, '')}
Colaborador ID: ${msg.from.id}
					`,
					{ parse_mode: 'Markdown' }
				)
			}

			console.log('SerieName ~>', serieName)
			jsonfile.writeFileSync(file, data, {
				replacer: true,
				spaces: '\t'
			})
			search.addDocuments(data.stickers)
		}
	} else if (msg.sticker && msg.sticker.file_id) {
		var stickerId = msg.sticker.file_id
		console.log('Input Sticker ~>', stickerId)
		text = `StickerID:${stickerId}`
		if (!checkStickers(stickerId)) {
			text += '\n\nJá achei esse sticker no meu bando de dados!'
			var serie = search.search(stickerId.toString())
			if (serie.length != 0) {
				text += `\nSeu nome de pesquisar atual é: ${serie[0].name.replace(/\s/g, '')}\n`
			}
			text += '\n‼️ Você pode enviar um novo nome e o moderador vai escolher o melhor.'
		}
		text += '\n\n🖍 Qual é o nome da série?'
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
		name = name.split('').toString().replace(/,/g, '').replace(/[\W\d]/g, 'c')
		series = series.sort((a, b) => {
			var indexA = a.name.replace(/\s/g, '').replace(/[\W\d]/g, 'c')
			var indexB = b.name.replace(/\s/g, '').replace(/[\W\d]/g, 'c')
			if (similarity(indexA, name) < similarity(indexB, name)) { return 1 }
			if (similarity(indexA, name) > similarity(indexB, name)) { return -1  }
			return 0
		})
		for (serie of series) {
			result.push({
				type: 'sticker',
				id: `${serie.id}`,
				sticker_file_id: `${serie.id}`
			})
		}
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

bot.on('callback_query', (ctx) => {
	if (ctx.update && ctx.update.callback_query && ctx.update.callback_query.data) {
		var callbackData = ctx.update.callback_query.data.split(':')
		var status = (callbackData[0] == 'true' ? true : false)
		var stickerId = callbackData[1]
		var stickerData = data.sugestion.reduce((total, sticker) => {
			return sticker.id == stickerId ? sticker : total
		}, false)

		var textCallback = 'Aplicação foi negada ‼️'
		var textUser = `❌ Modificação de Sticker
Sua Sugestão foi **NEGADA**!
Seu texto de sugestão foi: \`${stickerData.name.replace(/\s/g, '')}\`
Você pode ver o motivo falando com @TiagoEDGE
`

		if (stickerData) {
			data.sugestion = data.sugestion.reduce((total, sticker) => {
				if (sticker.id != stickerId) {
					total.push(sticker)
				}
				return total
			}, []) //Remove sugestion list
			if (status) {
				data.stickers = data.stickers.reduce((total, sticker) => {
					if (sticker.id == stickerId) {
						total.push(stickerData)
					} else {
						total.push(sticker)
					}
					return total
				}, []) //Use sugestion

				textCallback = 'Aplicação foi aceita ‼️'
				textUser = `✅ Modificação de Sticker
Sua Sugestão foi **ACEITA**!
Novo id de pesquisar é: \`${stickerData.name.replace(/\s/g, '')}\`
`
				bot.telegram.sendSticker(process.env.channel_id, stickerData.id)
				bot.telegram.sendMessage(process.env.channel_id, `
📌 *Sticker (Atualização de dados)*
Sticker ID: \`${stickerData.id}\`
Pesquisar ID: ${stickerData.name.replace(/\s/g, '')}
Colaborador ID: ${stickerData.user}
					`,
					{ parse_mode: 'Markdown' }
				)
			}

			ctx.answerCbQuery(
				textCallback,
				true
			)
			bot.telegram.sendMessage(
				stickerData.user,
				textUser,
				{ parse_mode: 'Markdown' }
			)

			jsonfile.writeFileSync(file, data, {
				replacer: true,
				spaces: '\t'
			})
			search.addDocuments(data.stickers)
		} else {
			ctx.answerCbQuery(
				'Você já selecionou esta opção ‼️',
				true
			)
		}
	}
})

bot.startPolling()
