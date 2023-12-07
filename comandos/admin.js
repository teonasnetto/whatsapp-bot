//REQUERINDO MODULOS
const { decryptMedia } = require('@open-wa/wa-decrypt')
const menu = require('../lib/menu')
const moment = require("moment-timezone")
const { version } = require('../package.json');
const msgs_texto = require('../lib/msgs')
const {criarTexto,erroComandoMsg, removerNegritoComando, timestampParaData} = require('../lib/util')
const {desbloquearComandosGlobal, bloquearComandosGlobal} = require("../lib/bloqueioComandos")
const cadastrarGrupo = require("../lib/cadastrarGrupo")
const db = require('../lib/database')
const fs = require("fs-extra")
const path = require("path")
const {botAlterarLimitador, botInfo, botAlterarLimiteDiario, botQtdLimiteDiario, botAlterarLimitarMensagensPv, botAlterarAutoSticker, botAlterarAntitrava, botAlterarPvLiberado} = require('../lib/bot')

let admin = async(client,message) => {
    try{
        const {id, chatId, sender, isGroupMsg, t, chat, caption, type, mimetype, isMedia, quotedMsg, quotedMsgObj, mentionedJidList } = message
        let { body } = message
        const commands = caption || body || ''
        let command = commands.toLowerCase().split(' ')[0] || ''
        command = removerNegritoComando(command)
        const args =  commands.split(' ')
        const botNumber = await client.getHostNumber()
        const blockNumber = await client.getBlockedIds()
        const groupId = isGroupMsg ? chat.groupMetadata.id : ''
        const ownerNumber = process.env.NUMERO_DONO.trim()
        const isOwner = ownerNumber == sender.id.replace(/@c.us/g, '')
        if (!isOwner) return client.reply(chatId, msgs_texto.permissao.apenas_dono_bot, id)

        switch(command){
            case "!admin":
                await client.sendText(chatId, menu.menuAdmin())
                break

            case "!infocompleta":{
                let fotoBot = await client.getProfilePicFromServer(botNumber+'@c.us')
                let infoBot = JSON.parse(fs.readFileSync(path.resolve("database/json/bot.json")))
                let expiracaoLimiteDiario = timestampParaData(infoBot.limite_diario.expiracao * 1000)
                let botInicializacaoData = timestampParaData(infoBot.iniciado)
                let resposta = criarTexto(msgs_texto.admin.infocompleta.resposta_superior, infoBot.criador, infoBot.nome, botInicializacaoData, version)
                // AUTO-STICKER
                resposta += (infoBot.autosticker) ? msgs_texto.admin.infocompleta.resposta_variavel.autosticker.on: msgs_texto.admin.infocompleta.resposta_variavel.autosticker.off
                // PV LIBERADO
                resposta += (infoBot.pvliberado) ? msgs_texto.admin.infocompleta.resposta_variavel.pvliberado.on: msgs_texto.admin.infocompleta.resposta_variavel.pvliberado.off
                // ANTI-TRAVA
                resposta += (infoBot.antitrava.status) ? criarTexto(msgs_texto.admin.infocompleta.resposta_variavel.antitrava.on,  infoBot.antitrava.max_caracteres) : msgs_texto.admin.infocompleta.resposta_variavel.antitrava.off
                // LIMITE COMANDOS DIARIO
                resposta += (infoBot.limite_diario.status) ? criarTexto(msgs_texto.admin.infocompleta.resposta_variavel.limite_diario.on,  expiracaoLimiteDiario) : msgs_texto.admin.infocompleta.resposta_variavel.limite_diario.off
                // LIMITE COMANDOS POR MINUTO
                resposta += (infoBot.limitecomandos.status) ? criarTexto(msgs_texto.admin.infocompleta.resposta_variavel.taxa_comandos.on, infoBot.limitecomandos.cmds_minuto_max, infoBot.limitecomandos.tempo_bloqueio) : msgs_texto.admin.infocompleta.resposta_variavel.taxa_comandos.off
                // LIMITE MENSAGENS PV
                resposta += (infoBot.limitarmensagens.status) ? criarTexto(msgs_texto.admin.infocompleta.resposta_variavel.limitarmsgs.on, infoBot.limitarmensagens.max, infoBot.limitarmensagens.intervalo) : msgs_texto.admin.infocompleta.resposta_variavel.limitarmsgs.off
                // BLOQUEIO DE COMANDOS
                resposta += (infoBot.bloqueio_cmds.length != 0) ? criarTexto(msgs_texto.admin.infocompleta.resposta_variavel.bloqueiocmds.on, infoBot.bloqueio_cmds.toString()) : msgs_texto.admin.infocompleta.resposta_variavel.bloqueiocmds.off
                resposta += criarTexto(msgs_texto.admin.infocompleta.resposta_inferior, blockNumber.length, infoBot.cmds_executados, ownerNumber)
                if(fotoBot && fotoBot != "ERROR: 404") await client.sendFileFromUrl(chatId, fotoBot, "foto.jpg", resposta, id)
                else await client.reply(chatId, resposta, id)
                break}

            case '!entrargrupo':{
                if (args.length < 2) return await client.reply(chatId, erroComandoMsg(command), id)
                let linkGrupo = args[1]
                // var totalGrupos = await client.getAllGroups()
                let linkValido = linkGrupo.match(/(https:\/\/chat.whatsapp.com)/gi)
                let conviteInfo = await client.inviteInfo(linkGrupo)
                if (!linkValido) return await client.reply(chatId, msgs_texto.admin.entrar_grupo.link_invalido, id)
                // if (totalGrupos.length > 10) return await client.reply(chatId, msgs_texto.admin.entrar_grupo.maximo_grupos, id)
                if (conviteInfo.status === 200) {
                    client.joinGroupViaLink(linkGrupo).then(async () => {
                        await cadastrarGrupo(conviteInfo.groupMetadata.id, "added", client);
                        await client.reply(chatId, msgs_texto.admin.entrar_grupo.entrar_sucesso,id);
                    })
                }
                else {
                    await client.reply(chatId, msgs_texto.admin.entrar_grupo.link_invalido, id)
                }
                break}

            case '!ativargrupo':{
                var grupoInfo = await db.obterGrupo(groupId)
                var estadoNovo = !grupoInfo.grupo_ativo
                if (estadoNovo) {
                    await db.alterarGrupoAtivo(groupId)
                    await client.reply(chatId,  msgs_texto.grupo.ativargrupo.ligado, id)
                } else {
                    await db.alterarGrupoAtivo(groupId,false)
                    await client.reply(chatId,  msgs_texto.grupo.ativargrupo.desligado, id)

                }
                break
            }
            case '!sair':
                if (!isGroupMsg) return await client.reply(chatId, msgs_texto.permissao.grupo, id)
                await client.sendText(chatId, msgs_texto.admin.sair.sair_sucesso)
                await client.leaveGroup(groupId)
                break

            case '!listablock':{
                let resposta = criarTexto(msgs_texto.admin.listablock.resposta_titulo, blockNumber.length)
                for (let i of blockNumber) resposta += criarTexto(msgs_texto.admin.listablock.resposta_itens, i.replace(/@c.us/g,''))
                await client.sendTextWithMentions(chatId, resposta, id)
                break}

            case '!limpartudo':{
                let chats = await client.getAllChats()
                for (let c of chats) await client.deleteChat(c.id)
                await client.sendText(ownerNumber+"@c.us", msgs_texto.admin.limpar.limpar_sucesso)
                break}

            case "!bcmdglobal":{
                if(args.length === 1) return await client.reply(chatId, erroComandoMsg(command) ,id)
                let usuarioComandos = body.slice(12).split(" "), respostaBloqueio = await bloquearComandosGlobal(usuarioComandos)
                await client.reply(chatId, respostaBloqueio, id)
                break}

            case "!dcmdglobal":{
                if(args.length === 1) return await client.reply(chatId,erroComandoMsg(command),id)
                let usuarioComandos = body.slice(12).split(" "), respostaDesbloqueio = await desbloquearComandosGlobal(usuarioComandos)
                await client.reply(chatId, respostaDesbloqueio, id)
                break}

            case '!limpar':{
                let chats = await client.getAllChats()
                for (let c of chats) {
                    if(c.id.match(/@c.us/g) && c.id != sender.id) await client.deleteChat(c.id)
                }
                await client.sendText(ownerNumber+"@c.us", msgs_texto.admin.limpar.limpar_sucesso)
                break}

            case '!rconfig':{
                await db.resetarGrupos()
                await client.reply(chatId,msgs_texto.admin.rconfig.reset_sucesso,id)
                break}

            case '!sairgrupos':{
                let grupos = await client.getAllGroups()
                for (let grupo of grupos) await client.leaveGroup(grupo.contact.id)
                let resposta = criarTexto(msgs_texto.admin.sairtodos.resposta, grupos.length)
                await client.sendText(ownerNumber+"@c.us", resposta, id)
                break}

            case "!bloquear":{
                let usuariosBloqueados = []
                if(quotedMsg){
                    usuariosBloqueados.push(quotedMsgObj.author)
                } else if(mentionedJidList.length > 1) {
                    usuariosBloqueados = mentionedJidList
                } else {
                    let numeroInserido = body.slice(10).trim()
                    if(numeroInserido.length == 0) return await client.reply(chatId, erroComandoMsg(command), id)
                    usuariosBloqueados.push(numeroInserido.replace(/\W+/g,"")+"@c.us")
                }
                for (let usuario of usuariosBloqueados){
                    if(await client.getContact(usuario)){
                        if(ownerNumber == usuario.replace(/@c.us/g, '')){
                            await client.sendTextWithMentions(chatId, criarTexto(msgs_texto.admin.bloquear.erro_dono, usuario.replace(/@c.us/g, '')))
                        } else if(blockNumber.includes(usuario)) {
                                await client.sendTextWithMentions(chatId, criarTexto(msgs_texto.admin.bloquear.ja_bloqueado, usuario.replace(/@c.us/g, '')))
                            } else {
                                client.contactBlock(usuario)
                                await client.sendTextWithMentions(chatId, criarTexto(msgs_texto.admin.bloquear.sucesso, usuario.replace(/@c.us/g, '')))
                            }
                    } else {
                        await client.reply(chatId, criarTexto(msgs_texto.admin.bloquear.erro, usuario.replace("@c.us","")), id)
                    }
                }
                break}

            case "!desbloquear":{
                let usuariosDesbloqueados = []
                if(quotedMsg){
                    usuariosDesbloqueados.push(quotedMsgObj.author)
                } else if(mentionedJidList.length > 1) {
                    usuariosDesbloqueados = mentionedJidList
                } else {
                    let numeroInserido = body.slice(13).trim()
                    if(numeroInserido.length == 0) return await client.reply(chatId, erroComandoMsg(command), id)
                    usuariosDesbloqueados.push(numeroInserido.replace(/\W+/g,"")+"@c.us")
                }
                for (let usuario of usuariosDesbloqueados){
                    if(!blockNumber.includes(usuario)) {
                        await client.sendTextWithMentions(chatId, criarTexto(msgs_texto.admin.desbloquear.ja_desbloqueado, usuario.replace(/@c.us/g,'')))
                    } else {
                        client.contactUnblock(usuario)
                        await client.sendTextWithMentions(chatId, criarTexto(msgs_texto.admin.desbloquear.sucesso, usuario.replace(/@c.us/g,'')))
                    }
                }
                break}

            case "!autostickerpv":{
                let novoEstado = !botInfo().autosticker
                if(novoEstado){
                    botAlterarAutoSticker(true)
                    await client.reply(chatId, msgs_texto.admin.autostickerpv.ativado,id)
                } else {
                    botAlterarAutoSticker(false)
                    await client.reply(chatId, msgs_texto.admin.autostickerpv.desativado,id)
                }
                break}

            case "!pvliberado":{
                let novoEstado = !botInfo().pvliberado
                if(novoEstado){
                    botAlterarPvLiberado(true)
                    await client.reply(chatId, msgs_texto.admin.pvliberado.ativado,id)
                } else {
                    botAlterarPvLiberado(false)
                    await client.reply(chatId, msgs_texto.admin.pvliberado.desativado,id)
                }
                break}

            case "!fotobot":{
                if(isMedia || quotedMsg){
                    let dadosMensagem = {
                        tipo : (isMedia) ? type : quotedMsg.type,
                        mimetype : (isMedia)? mimetype : quotedMsg.mimetype,
                        mensagem: (isMedia) ? message : quotedMsg
                    }
                    if(dadosMensagem.tipo === "image"){
                        let mediaData = await decryptMedia(dadosMensagem.mensagem)
                        let imagemBase64 = `data:${dadosMensagem.mimetype};base64,${mediaData.toString('base64')}`
                        let res = await client.setProfilePic(imagemBase64)
                        if(res) await client.reply(chatId, msgs_texto.admin.fotobot.sucesso, id)
                        else await client.reply(chatId, msgs_texto.admin.fotobot.erro, id)
                    } else {
                        return client.reply(chatId, erroComandoMsg(command) , id)
                    }
                } else {
                    return client.reply(chatId, erroComandoMsg(command) , id)
                }
                break}

            case "!antitravapv":{
                let novoEstado = !botInfo().antitrava.status
                if(novoEstado){
                    let maxCaracteres = args[1] || 1500
                    if(isNaN(maxCaracteres) || maxCaracteres < 250) return await client.reply(chatId, msgs_texto.admin.antitrava.qtd_invalida, id)
                    botAlterarAntitrava(true, maxCaracteres)
                    await client.reply(chatId, criarTexto(msgs_texto.admin.antitrava.ligado, maxCaracteres), id)
                } else {
                    botAlterarAntitrava(false, 0)
                    await client.reply(chatId, msgs_texto.admin.antitrava.desligado, id)
                }
                break}

            case "!limitediario":{
                let novoEstado = !botInfo().limite_diario.status
                if(novoEstado){
                    botAlterarLimiteDiario(true)
                    await client.reply(chatId, msgs_texto.admin.limitediario.ativado,id)
                } else {
                    botAlterarLimiteDiario(false)
                    await client.reply(chatId, msgs_texto.admin.limitediario.desativado,id)
                }
                break}

            case "!taxalimite":{
                let novoEstado = !botInfo().limitecomandos.status
                if(novoEstado){
                    if(args.length !== 3) return await client.reply(chatId, erroComandoMsg(command), id)
                    let qtd_max_minuto = args[1], tempo_bloqueio = args[2]
                    if(isNaN(qtd_max_minuto) || qtd_max_minuto < 3) return await client.reply(chatId,msgs_texto.admin.limitecomandos.qtd_invalida,id)
                    if(isNaN(tempo_bloqueio) || tempo_bloqueio < 10) return await client.reply(chatId,msgs_texto.admin.limitecomandos.tempo_invalido,id)
                    botAlterarLimitador(true, parseInt(qtd_max_minuto), parseInt(tempo_bloqueio))
                    await client.reply(chatId, msgs_texto.admin.limitecomandos.ativado,id)
                } else {
                    botAlterarLimitador(false)
                    await client.reply(chatId, msgs_texto.admin.limitecomandos.desativado,id)
                }
                break}

            case "!limitarmsgs":{
                let novoEstado = !botInfo().limitarmensagens.status
                if(novoEstado){
                    if(args.length !== 3) return await client.reply(chatId, erroComandoMsg(command), id)
                    let max_msg = args[1], msgs_intervalo = args[2]
                    if(isNaN(max_msg) || max_msg < 3) return await client.reply(chatId,msgs_texto.admin.limitarmsgs.qtd_invalida,id)
                    if(isNaN(msgs_intervalo) || msgs_intervalo < 10) return await client.reply(chatId,msgs_texto.admin.limitarmsgs.tempo_invalido,id)
                    botAlterarLimitarMensagensPv(true,parseInt(max_msg),parseInt(msgs_intervalo))
                    await client.reply(chatId, msgs_texto.admin.limitarmsgs.ativado,id)
                } else {
                    botAlterarLimitarMensagensPv(false)
                    await client.reply(chatId, msgs_texto.admin.limitarmsgs.desativado,id)
                }
                break}

            case "!mudarlimite":{
                if(!botInfo().limite_diario.status) return await client.reply(chatId, msgs_texto.admin.mudarlimite.erro_limite_diario,id)
                if(args.length === 1) return await client.reply(chatId, erroComandoMsg(command),id)
                let tipo = args[1].toLowerCase(), qtd = args[2]
                if(qtd != -1) if(isNaN(qtd) || qtd < 5) return await client.reply(chatId, msgs_texto.admin.mudarlimite.invalido,id)
                let alterou = await botQtdLimiteDiario(tipo, parseInt(qtd))
                if(!alterou) return await client.reply(chatId, msgs_texto.admin.mudarlimite.tipo_invalido,id)
                await client.reply(chatId, criarTexto(msgs_texto.admin.mudarlimite.sucesso, tipo.toUpperCase(), qtd == -1 ? "∞" : qtd), id)
                break}

            case "!usuarios":{
                if(args.length === 1) return await client.reply(chatId, erroComandoMsg(command), id)
                let tipo = args[1].toLowerCase()
                let usuarios = await db.obterUsuariosTipo(tipo)
                if(usuarios.length == 0) return await client.reply(chatId, msgs_texto.admin.usuarios.nao_encontrado, id)
                let respostaItens = ''
                for (let usuario of usuarios) respostaItens += criarTexto(msgs_texto.admin.usuarios.resposta_item, usuario.nome, usuario.id_usuario.replace("@c.us", ""), usuario.comandos_total)
                let resposta = criarTexto(msgs_texto.admin.usuarios.resposta_titulo, tipo.toUpperCase(), usuarios.length, respostaItens)
                await client.sendTextWithMentions(chatId, resposta)
                break}

            case "!limpartipo":{
                if(args.length === 1) return await client.reply(chatId, erroComandoMsg(command), id)
                let tipo = args[1].toLowerCase()
                let limpou = await db.limparTipo(tipo)
                if(!limpou) return await client.reply(chatId, msgs_texto.admin.limpartipo.erro, id)
                await client.reply(chatId, criarTexto(msgs_texto.admin.limpartipo.sucesso, tipo.toUpperCase()), id)
                break}

            case "!alterartipo":{
                if(args.length === 1) return await client.reply(chatId, erroComandoMsg(command), id)
                let usuario_tipo = ""
                if(quotedMsg) usuario_tipo = quotedMsgObj.author
                else if(mentionedJidList.length === 1) usuario_tipo = mentionedJidList[0]
                else if(args.length > 2) usuario_tipo = args.slice(2).join("").replace(/\W+/g,"")+"@c.us"
                else return await client.reply(chatId, erroComandoMsg(command),id)
                if(ownerNumber == usuario_tipo.replace("@c.us","")) return await client.reply(chatId, msgs_texto.admin.alterartipo.tipo_dono,id)
                let c_registrado = await db.verificarRegistro(usuario_tipo)
                if(c_registrado){
                    let alterou = await db.alterarTipoUsuario(usuario_tipo, args[1])
                    if(!alterou) return await client.reply(msgs_texto.admin.alterartipo.tipo_invalido, id)
                    await client.reply(chatId, criarTexto(msgs_texto.admin.alterartipo.sucesso, args[1].toUpperCase()),id)
                } else {
                    await client.reply(chatId, msgs_texto.admin.alterartipo.nao_registrado,id)
                }
                break}

            case "!tipos":{
                let tipos = botInfo().limite_diario.limite_tipos, respostaTipos = ''
                for (let tipo in tipos) respostaTipos += criarTexto(msgs_texto.admin.tipos.item_tipo, msgs_texto.tipos[tipo], tipos[tipo] || "∞")
                await client.reply(chatId, criarTexto(msgs_texto.admin.tipos.resposta, respostaTipos), id)
                break}

            case "!rtodos":{
                if(!botInfo().limite_diario.status) return await client.reply(chatId, msgs_texto.admin.rtodos.erro_limite_diario,id)
                await db.resetarComandosDia()
                await client.reply(chatId, msgs_texto.admin.rtodos.sucesso,id)
                break}

            case "!r":{
                if(!botInfo().limite_diario.status) return await client.reply(chatId, msgs_texto.admin.r.erro_limite_diario,id)
                if(quotedMsg){
                    let r_registrado = await db.verificarRegistro(quotedMsgObj.author)
                    if(r_registrado){
                        await db.resetarComandosDiaUsuario(quotedMsgObj.author)
                        await client.reply(chatId, msgs_texto.admin.r.sucesso,id)
                    } else {
                        return await client.reply(chatId, msgs_texto.admin.r.nao_registrado,id)
                    }
                } else if (mentionedJidList.length === 1){
                    let r_registrado = await db.verificarRegistro(mentionedJidList[0])
                    if(r_registrado){
                        await db.resetarComandosDiaUsuario(mentionedJidList[0])
                        await client.reply(chatId, msgs_texto.admin.r.sucesso,id)
                    } else {
                        return await client.reply(chatId, msgs_texto.admin.r.nao_registrado,id)
                    }
                } else if(args.length >= 1){
                    let r_numero_usuario = ""
                    for (let i = 1; i < args.length; i++){
                        r_numero_usuario += args[i]
                    }
                    r_numero_usuario = r_numero_usuario.replace(/\W+/g,"")
                    let r_registrado = await db.verificarRegistro(r_numero_usuario+"@c.us")
                    if(r_registrado){
                        await db.resetarComandosDiaUsuario(r_numero_usuario+"@c.us")
                        await client.reply(chatId, msgs_texto.admin.r.sucesso,id)
                    } else {
                        return await client.reply(chatId, msgs_texto.admin.r.nao_registrado,id)
                    }
                } else {
                    return await client.reply(chatId, erroComandoMsg(command),id)
                }
                break}

            case "!verdados":{
                let idUsuario = "", dadosUsuario = {}
                if(quotedMsg) idUsuario = quotedMsgObj.author
                else if(mentionedJidList.length === 1) idUsuario = mentionedJidList[0]
                else if(args.length >= 1) idUsuario =  args.slice(1).join("").replace(/\W+/g,"")+"@c.us"
                else return await client.reply(chatId, erroComandoMsg(command),id)
                let usuarioRegistrado = await db.verificarRegistro(idUsuario)
                if(usuarioRegistrado) dadosUsuario = await db.obterUsuario(idUsuario)
                else return await client.reply(chatId,msgs_texto.admin.verdados.nao_registrado,id)
                let maxComandosDia = dadosUsuario.max_comandos_dia || "Sem limite"
                let tipoUsuario = msgs_texto.tipos[dadosUsuario.tipo]
                let nomeUsuario =  dadosUsuario.nome || "Ainda não obtido"
                let resposta = criarTexto(msgs_texto.admin.verdados.resposta_superior, nomeUsuario, tipoUsuario, dadosUsuario.id_usuario.replace("@c.us",""))
                if(botInfo().limite_diario.status) resposta += criarTexto(msgs_texto.admin.verdados.resposta_variavel.limite_diario.on, dadosUsuario.comandos_dia, maxComandosDia, maxComandosDia)
                resposta += criarTexto(msgs_texto.admin.verdados.resposta_inferior, dadosUsuario.comandos_total)
                await client.reply(chatId, resposta, id)
                break
}
            case '!bctodos':{
                if(args.length === 1) return await client.reply(chatId, erroComandoMsg(command), id)
                let mensagem = body.slice(9).trim(), chats = await client.getAllChats(), bloqueados = await client.getBlockedIds()
                await client.reply(chatId, criarTexto(msgs_texto.admin.bctodos.espera, chats.length, chats.length), id)
                for (let chat of chats) {
                    if (chat.isGroup && !chat.isReadOnly && !chat.isAnnounceGrpRestrict) {
                        await new Promise((resolve) => {
                            setTimeout(() => {
                                resolve(client.sendText(chat.id, criarTexto(msgs_texto.admin.bctodos.anuncio, mensagem)));
                            }, 1000);
                        });
                    } else if (!bloqueados.includes(chat.id)) {
                            await new Promise((resolve) => {
                                setTimeout(() => {
                                    resolve(client.sendText(chat.id, criarTexto(msgs_texto.admin.bctodos.anuncio, mensagem)));
                                }, 1000);
                            });
                        } else {
                            resolve(); // Added resolve() to fix the issue
                        }
                }
                await client.reply(chatId, msgs_texto.admin.bctodos.bc_sucesso , id)
                break}

            case '!bccontatos':{
                if(args.length === 1) return client.reply(chatId, erroComandoMsg(command), id)
                let mensagem = body.slice(12).trim(), chats = await client.getAllChats(), grupos = await client.getAllGroups(), bloqueados = await client.getBlockedIds(), qtdChatContatos = chats.length - grupos.length
                await client.reply(chatId, criarTexto(msgs_texto.admin.bccontatos.espera, qtdChatContatos, qtdChatContatos), id)
                for (let chat of chats) {
                    if(!chat.isGroup && !bloqueados.includes(chat.id)) {
                        await new Promise((resolve)=>{
                            setTimeout(async ()=>{
                                resolve(await client.sendText(chat.id, criarTexto(msgs_texto.admin.bccontatos.anuncio, mensagem)))
                            }, 1000)
                        })
                    }
                }
                await client.reply(chatId, msgs_texto.admin.bccontatos.bc_sucesso , id)
                break}

            case '!bcgrupos':{
                if(args.length === 1) return client.reply(chatId, erroComandoMsg(command), id)
                let mensagem = body.slice(10).trim(), grupos = await client.getAllGroups()
                await client.reply(chatId, criarTexto(msgs_texto.admin.bcgrupos.espera, grupos.length, grupos.length) , id)
                for (let grupo of grupos) {
                    if (!grupo.isReadOnly && !grupo.isAnnounceGrpRestrict) {
                        await new Promise((resolve)=>{
                            setTimeout(async ()=>{
                                resolve(await client.sendText(grupo.id, criarTexto(msgs_texto.admin.bcgrupos.anuncio, mensagem)))
                            }, 1000)
                        })
                    }
                }
                await client.reply(chatId, msgs_texto.admin.bcgrupos.bc_sucesso , id)
                break}

            case "!grupos":{
                let grupos = await client.getAllGroups(), resposta = criarTexto(msgs_texto.admin.grupos.resposta_titulo, grupos.length)
                for (let grupo of grupos){
                    let adminsGrupo = await client.getGroupAdmins(grupo.id)
                    let botAdmin = adminsGrupo.includes(botNumber + '@c.us')
                    let linkGrupo = "Não Disponível"
                    if(botAdmin) linkGrupo = await client.getGroupInviteLink(grupo.id)
                    resposta += criarTexto(msgs_texto.admin.grupos.resposta_itens, grupo.formattedTitle, grupo.groupMetadata.participants.length, botAdmin ? "Sim" : "Não", linkGrupo)
                }
                await client.reply(chatId, resposta, id)
                break}

            case "!gruposcadastrados":{
                let grupos = await db.obterTodosGrupos(), resposta = criarTexto(msgs_texto.admin.grupos.resposta_titulo, grupos.length)
                let todosGrupos = await client.getAllGroups()
                for (let grupo of grupos){
                    let grupoExiste = todosGrupos.find(g => g.id == grupo.id_grupo)
                    if (grupoExiste){
                        let adminsGrupo = await client.getGroupAdmins(grupoExiste.id_grupo)
                        let botAdmin = adminsGrupo.includes(botNumber + '@c.us')
                        let linkGrupo = "Não Disponível"
                        if(botAdmin) linkGrupo = await client.getGroupInviteLink(grupo.id_grupo)
                        resposta += criarTexto(msgs_texto.admin.grupos.resposta_itens, grupoExiste.formattedTitle, grupoExiste.groupMetadata.participants.length, botAdmin ? "Sim" : "Não", linkGrupo)
                    }
                }
                await client.reply(chatId, resposta, id)
                break
            }

            case '!print':{
                let print = await client.getSnapshot()
                await client.sendFile(chatId,print,"print.png",'Captura de Tela',id)
                break}

            case '!estado':{
                if(args.length != 2)  return client.reply(chatId,erroComandoMsg(command),id)
                switch(args[1]){
                    case 'online':
                        await client.setMyStatus("< 🟢 Online />")
                        await client.reply(chatId,msgs_texto.admin.estado.sucesso,id)
                        break
                    case 'offline':
                        await client.setMyStatus("< 🔴 Offline />")
                        await client.reply(chatId,msgs_texto.admin.estado.sucesso,id)
                        break
                    case 'manutencao':
                        await client.setMyStatus("< 🟡 Manutenção />")
                        await client.reply(chatId,msgs_texto.admin.estado.sucesso,id)
                        break
                    default:
                        await client.reply(chatId, erroComandoMsg(command), id)
                }
                break}

            case '!desligar':{
                await client.reply(chatId, msgs_texto.admin.desligar.sucesso, id)
                await client.kill()
                break}
        }
    } catch(err){
        console.log(err)
        throw err
    }

}

module.exports = admin