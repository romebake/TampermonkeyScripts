// ==UserScript==
// @name         Omen小工具
// @namespace    http://tampermonkey.net/
// @version      0.7.15
// @description  try to take over the world!
// @author       jiye
// @match        https://keylol.com/*
// @match        https://login3.id.hp.com/*
// @grant        GM_log
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_getTab
// @grant        GM_saveTab
// @grant        GM_getTabs
// @grant        unsafeWindow
// @connect     oauth.hpbp.io
// @connect    task.jysafe.cn
// @connect    www.hpgamestream.com
// @connect    rpc-prod.versussystems.com
// @connect    api.hpbp.io
// @require      https://cdn.staticfile.org/jquery/3.3.1/jquery.min.js
// @require      https://cdn.jsdelivr.net/gh/jiyeme/OmenScript@2455ec2ff19eaf628b10d792bf2e95bbf28c8ff2/js/sha256.min.js
// @icon         https://www.google.com/s2/favicons?domain=keylol.com
// @updateURL   https://raw.githubusercontent.com/jiyeme/OmenScript/master/omen.user.js
// @downloadURL     https://raw.githubusercontent.com/jiyeme/OmenScript/master/omen.user.js
// @namespace  jiyecafe@gmail.com-omen
// ==/UserScript==
// TODO: 自动弹出地址？
// @require      http://127.0.0.1:5500/js/main.ed19e0b4.chunk.js

(function () {
    'use strict';

    // Your code here...
    const jq = $
    const ApplicationId = "6589915c-6aa7-4f1b-9ef5-32fa2220c844";
    const ClientId = "130d43f1-bb22-4a9c-ba48-d5743e84d113";
    const debug = true;
    let omenAccount = GM_getValue("omenAccount") || {};
    let omenInfo = null;

    const HTTP = (function () {

        // [修改自https://greasyfork.org/zh-CN/scripts/370650]
        const httpRequest = function (e) {
            const requestObj = {}
            requestObj.url = e.url
            requestObj.method = e.method.toUpperCase()
            requestObj.timeout = e.timeout || 30000
            if (e.dataType) requestObj.responseType = e.dataType
            if (e.headers) requestObj.headers = e.headers
            if (e.data) requestObj.data = e.data
            if (e.cookie) requestObj.cookie = e.cookie
            if (e.anonymous) requestObj.anonymous = e.anonymous
            if (e.onload) requestObj.onload = e.onload
            if (e.fetch) requestObj.fetch = e.fetch
            if (e.onreadystatechange) requestObj.onreadystatechange = e.onreadystatechange
            requestObj.ontimeout = e.ontimeout || function (data) {
                if (debug) console.log(data)
                if (e.status) e.status.error('Error:Timeout(0)')
                if (e.r) e.r({ result: 'error', statusText: 'Timeout', status: 0, option: e })
            }
            requestObj.onabort = e.onabort || function (data) {
                if (debug) console.log(data)
                if (e.status) e.status.error('Error:Aborted(0)')
                if (e.r) e.r({ result: 'error', statusText: 'Aborted', status: 0, option: e })
            }
            requestObj.onerror = e.onerror || function (data) {
                if (debug) console.log(data)
                if (e.status) e.status.error('Error:Error(0)')
                if (e.r) e.r({ result: 'error', statusText: 'Error', status: 0, option: e })
            }
            if (debug) console.log('发送请求:', requestObj)
            GM_xmlhttpRequest(requestObj);
        }
        function get(url, e = {}) {
            UI.showLoading();
            return new Promise((resolve, reject) => {
                e.url = url;
                e.method = "GET";
                e.onload = res => {
                    UI.hideLoading()
                    resolve(res)
                };
                e.onerror = err => {
                    UI.hideLoading()
                    reject(err)
                };
                httpRequest(e)
            })
        }
        function post(url, e = {}) {
            UI.showLoading();
            return new Promise((resolve, reject) => {
                e.url = url;
                e.method = "POST";
                e.onload = res => {
                    UI.hideLoading();
                    let resp = res.response;
                    if (resp.error) reject(resp);
                    else resolve(res);
                };
                e.onerror = err => {
                    UI.hideLoading();
                    reject(err);
                };
                httpRequest(e);
            })
        }
        return {
            GET: get,
            POST: post
        }
    })();

    const ACCOUNT = (() => {
        const set = (userInfo) => {
            console.log(userInfo)
            //const uinfo = JSON.parse(window.atob(tokenInfo.access_token.split(".")[1]))
            omenAccount[userInfo.email] = userInfo
            GM_setValue("omenAccount", omenAccount)
            omenInfo = userInfo;
        }
        const change = (email) => {
            omenInfo = omenAccount[email];
        }
        const updateAuth = (auth) => {
            let email = omenInfo.email;
            omenAccount[email].auth = auth;
            omenInfo = omenAccount[email];
            GM_setValue("omenAccount", omenAccount)
        }
        return {
            set: set,
            change: change,
            updateAuth: updateAuth
        }
    })();
    const UI = (function () {
        let login_link = "https://oauth.hpbp.io/oauth/v1/auth?response_type=code&client_id=" + ClientId + "&redirect_uri=http://localhost:9081/login&scope=email+profile+offline_access+openid+user.profile.write+user.profile.username+user.profile.read&state=G5g495-R4cEE" + (Math.random() * 100000) + "&max_age=28800&acr_values=urn:hpbp:hpid&prompt=consent"
        let data = [];
        const config = [
            {
                id: "avaliable",
                name: "可参与列表",
                action: loadChallengeList,
                default: `
                <ul id="omen-avaliable-list">
                    <li><h2>可参与列表：</h2></li>
                </ul>`
            },
            {
                id: "current",
                name: "进行中",
                action: loadCurrentList,
                default: `
                <ul id="omen-current-list">
                    <li><h2>进行中：</h2></li>
                </ul>`
            },
            {
                id: "prize",
                name: "奖品",
                action: loadPrizeList,
                default: `
                    <h2>等待开奖：</h2>
                    <ul class="pending"></ul>
                    <h2>赢得的奖励：</h2>
                    <ul class="won"></ul>
                    <h2>过期的：</h2>
                    <ul class="other"></ul>
`
            },
            {
                id: "log",
                name: "自动执行日志",
                action: null,
                default: `
                <ul id="omen-log-list">
                    <li>日志列表：</li>
                    <li></li>
                </ul>`
            },
            {
                id: "help",
                name: "帮助",
                action: null,
                default: `
                <div id="omen-help-list"><h2>帮助信息</h2>
                    <h3>一、任务执行类型区别</h3>
                    <p>
                        1.设定时间进行任务:<br/>
&nbsp;&nbsp;确定后立即提交任务进度数据，失败就是没有变化，成功按钮数值会发生变化。
<br />
2.自动执行任务:<br />
&nbsp;&nbsp;添加任务后，每隔30秒会提交一次“30秒的游戏时间”；刷新页面后也会继续执行，除非session失效。<br />
3.目前记录只会体现在日志区域。
                    </p>
                    <h3>二、一次性执行相关</h3>
                    <p>
                    惠普策略：
                    <ol style="margin-left: 30px;">
                        <li>关键词“最后一次提交时间”</li>
                        <li>参加成功后，服务器会设定“最后一次提交时间”为参加时间</li>
                        <li>每次提交成功后，服务器会设定“最后一次提交时间”当次提交时间</li>
                        <li>提交的信息是游戏时间，当次提交的时间应小于“最后一次提交时间与当前时间之差”</li>
                    </ol>
                    </p>

                </div>`
            }
        ]

        const init = () => {
            initToolBar();
            initIframe(login_link);
            if (document.getElementById("omen-account-switch").value !== "") ACCOUNT.change(document.getElementById("omen-account-switch").value)
            EventListener();
        }
        function initToolBar() {

            jq("#nav-user-action-bar > .list-inline > *:nth-child(1)").before(`<li id="jiye-action" class="btn btn-user-action" style="position: relative;z-index: 9;">工具
                   <ul class="jiye-action-list">
                           <li class="jiye-action-item" id="login-link">Omen</li>
                           <!--<li class="jiye-action-item">2</li>-->
                   </ul>
                </li>
                <style>
                .jiye-action-list{
                    position: absolute;
                    background-color: white;
                    min-width: 46px;
                    left: 0px;
                    margin-top: 6px;
                    display: none;
                    color: black;
                    border: solid 1px #999;
                }
                 #jiye-action:hover .jiye-action-list{
                         display: block!important;
                 }
                 .jiye-action-item{
                    padding: 6px 0px;
                 }
                 .jiye-action-item:hover{
                     background-color: #f0f3f4;
                 }
                </style>
                `);

        }

        const showLoading = () => {
            jq(".omen-content>.omen-header>.omen-loading>.icon").css("display", "initial");
            jq(".omen-content>.omen-header>.omen-loading").css("visibility", "visible");
        }
        const hideLoading = () => {
            jq(".omen-content>.omen-header>.omen-loading>.icon").css("display", "none");
            jq(".omen-content>.omen-header>.omen-loading").css("visibility", "hidden");
        }
        const updateAccountList = () => {
            jq("#omen-account-switch").empty();
            for (let _email in omenAccount) {
                jq("#omen-account-switch").append(`<option>${_email}</option>`);
            }
        }

        function initIframe(link) {
            let html = `
            <div id="omen-mask"></div>
<div id="omen-iframe" style="display:none">
    <div class="omen-content">
        <div class="omen-header">
            <div class="omen-loading"><svg  t="1624533378166" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2471" ><path d="M510.976 62.464c-247.296 0-448 200.704-448 448s200.704 448 448 448 448-200.704 448-448-200.704-448-448-448z m0 175.104c32.768 0 59.904 26.624 59.904 59.904 0 32.768-26.624 59.904-59.904 59.904s-59.904-26.624-59.904-59.904 27.136-59.904 59.904-59.904z m0 700.416c-117.76 0-213.504-95.744-213.504-213.504 0-117.76 90.624-213.504 213.504-213.504 117.76 0 213.504-95.744 213.504-213.504 0-111.616-85.504-203.264-194.56-212.992l-0.512-0.512c227.328 9.728 409.088 197.12 409.088 427.008-0.512 236.032-191.488 427.008-427.52 427.008z" fill="#1296db" p-id="2472"></path><path d="M451.072 724.48c0 32.768 26.624 59.904 59.904 59.904 32.768 0 59.904-26.624 59.904-59.904 0-32.768-26.624-59.904-59.904-59.904-32.768 0-59.904 26.624-59.904 59.904z" fill="#1296db" p-id="2473"></path></svg>
            少女祈祷中~</div>
            <svg  id="omen-iframe-close" onclick="document.getElementById('omen-mask').style.display = document.getElementById('omen-iframe').style.display = 'none'"
            t="1624536136145" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3441" width="20" height="20"><path d="M940.802 939.949c0 0.014 0 0.021-0.051 0.044-28.183 28.22-73.991 28.262-102.218 0.05L512.127 614.299 186.382 940.653c-0.051 0.021-0.051 0.05-0.051 0.05-28.227 28.235-74.035 28.256-102.262 0.052-28.328-28.248-28.372-74.05-0.146-102.32l325.746-326.37L83.313 186.312c-28.278-28.227-28.328-74.027-0.094-102.29 0-0.022 0-0.036 0.044-0.052 28.183-28.19 73.948-28.212 102.226-0.007l326.355 325.745L837.64 83.34l0.044-0.051c28.234-28.227 73.99-28.256 102.269-0.014 28.32 28.226 28.32 74.027 0.094 102.312L614.3 511.942l326.406 325.745c28.228 28.227 28.322 74.02 0.095 102.262z" p-id="3442" fill="#2c2c2c"></path></svg>
        </div>

        <div id="omen-account">切换账户：
            <select id="omen-account-switch" title="Omen账户">
            </select>
        </div>
        <div>
            <a href="${link}" target="_blank" style="font-size:1.5rem">登录</a><br>
            <label for="omen-localhost-link">
                localhost地址: <input id="omen-localhost-link" type="text" style="width: 90%;" placeholder="请粘贴登录后那个不能访问的地址，然后回车" />
            </label>
            <br>CODE:<span class="omen-code">等待...</span>
            <br>
            <button id="omen-refreshtoken">刷新AccessToken</button><span class="omen-tokenresult">等待...</span>
            <br>
            <button id="omen-getsession">获取SESSION</button><span class="omen-sessionresult">等待...</span>
            <br>
            <br>
        </div>
        <div id="omen-data">
            <div  id="omen-action-button" class="omen-action-button">
            </div>
            <div id="omen-item-area">
            </div>
        </div>
    </div>
</div>
<style>
    #omen-mask{
        width: 100%;
        height: 100%;
        position: fixed;
        left: 0;
        top: 0;
        z-index: 998;
        background: #000000d1!important;
        opacity: .85!important;
        display: none;
    }
    #omen-iframe{
        position: fixed;
        top: 10%;
        left: 15%;
        width: 70%;
        background-color: #66bbff;
        height: 80%;
        z-index: 999;
        overflow:hidden;
        border-radius: .5rem;
    }
    #omen-iframe .omen-content{
        margin:1rem;
    }
    .omen-content > .omen-header{
        height:20px;
        display:flex;
    }
    .omen-content .omen-loading{
        width: 53%;
        text-align: right;
        visibility: hidden;
    }
    .omen-content .omen-loading>.icon{
        height:20px;
        width:20px;
        display:none;
        transition: 0.5s;
        animation: rotate 1s linear infinite;  /*开始动画后无限循环，用来控制rotate*/
    }
    @keyframes rotate{
        0%{
                transform: rotate(0);
              }
        50%{
                transform:rotate(180deg);
            }
        100%{
                 transform: rotate(360deg);
                }
	}

    #omen-iframe-close{
        position: absolute;
        right: 20px;
        cursor: pointer;
    }
    input#omen-localhost-link:disabled {
        background-color: #dddddd;
    }
    #omen-data{
        border: solid 1px #f00;
        padding: .5rem;
    }
    #omen-item-area > *{
        max-height: 35vh;
        overflow-y: scroll;
    }
</style>
            `;

            jq("body").append(html);
            // 初始化下半部分
            for (let ele of config) {
                const view = document.createElement("div")
                view.style.display = "none";
                view.id = `omen-view-${ele.id}`;
                view.innerHTML = ele.default;
                jq("#omen-item-area").append(view);

                const btn = document.createElement("button")
                btn.id = `omen-${ele.id}-btn`;
                btn.innerText = ele.name;
                btn.onclick = (e) => {
                    jq("#omen-action-button > button").attr("disabled", false);
                    e.target.disabled = true;

                    jq("#omen-item-area > *").css("display", "none");
                    view.style.display = "block";
                    if (ele.action) ele.action(view.id);
                };
                jq("#omen-action-button").append(btn);

            }
            //document.getElementById("omen-iframe").style.display = "block"
            //document.getElementById("omen-mask").style.display = "block"
            updateAccountList();

        }
        function EventListener() {

            // 打开界面
            document.getElementById("login-link").addEventListener("click", () => {
                if (document.getElementById("omen-iframe").style.display === "block") return;

                document.getElementById("omen-iframe").style.display = "block"
                document.getElementById("omen-mask").style.display = "block"
                if (omenInfo == null) return;
                // accessTokenUpdate();
                // loadChallengeList();
                //let a = GM_addStyle("#omen-iframe{display:block!important;}")
                //GM_log(a)
            })
            // 账户切换
            document.getElementById("omen-account-switch").onchange = (e) => {
                ACCOUNT.change(document.getElementById("omen-account-switch").value)
                sessionTokenUpdate();
            }
            // localhost地址输入事件
            document.getElementById("omen-localhost-link").onchange = (e) => {
                console.log(e)
                let value = e.target.value
                let codeR = value.match(/code=(.*?)&/)
                jq("#omen-iframe .omen-tokenresult")[0].innerText = jq("#omen-iframe .omen-sessionresult")[0].innerText = "等待操作";
                if (codeR == null || codeR.length <= 1) {
                    jq("#omen-iframe .omen-code")[0].innerText = "解析失败";
                } else {
                    // 解析成功，获取认证信息
                    let auth = null
                    const startTime = parseInt(new Date().getTime() / 1000);

                    jq("#omen-iframe .omen-code")[0].innerText = codeR[1]
                    OMEN.getToken(codeR[1]).then(res => {
                        console.log(res)
                        auth = res.response
                        auth.startTime = startTime;
                        if (auth.status_code === undefined) {
                            jq("#omen-iframe .omen-tokenresult")[0].innerText = "成功"
                            return OMEN.getUserinfo(auth.access_token)
                        } else {
                            jq("#omen-iframe .omen-tokenresult")[0].innerText = auth.error_description
                        }
                    }).then(res => {
                        console.log(res)
                        const resp = res.response;
                        ACCOUNT.set({
                            auth: auth,
                            email: resp.email
                        })
                        updateAccountList();
                        document.getElementById("omen-account-switch").value = resp.email;
                    })
                }
            }

            document.getElementById("omen-refreshtoken").addEventListener("click", (e) => {
                accessTokenUpdate(true);
            })

            document.getElementById("omen-getsession").addEventListener("click", (e) => {
                sessionTokenUpdate();
            })
        }

        function loadChallengeList(id) {
            jq("#omen-avaliable-list").empty();
            OMEN.getChallengeList(omenInfo.sessionToken).then(res => {
                //console.log(res);
                let resp = res.response;
                console.log(resp)
                let list = resp.result.collection;
                jq("#omen-avaliable-list").append(`<li >数量: ${list.length}</li>`);

                list.forEach(item => {
                    let id = `${item.challengeStructureId}|${item.prize.campaignId}`
                    jq("#omen-avaliable-list").append(`<li >${item.prize.displayName} - ${item.displayName}    <button id="${id}">参加</button></li>`)
                    // 监听事件
                    document.getElementById(id).addEventListener("click", (e) => {
                        let id = e.target.id.split("|");
                        OMEN.join(omenInfo.sessionToken, id[0], id[1]).then(res => {
                            console.log(res)
                            if (res.status === 200) {
                                alert("参加成功")
                                document.getElementById(e.target.id).parentElement.remove()
                            } else {
                                alert("失败，详细信息在控制台");
                            }
                        })
                    })
                })

            }).catch(err => {
                console.log(err);
                const errD = err.error;
                if (errD.code === 603 && errD.message === "Session is not valid") {
                    sessionTokenUpdate();
                }
            });
        }
        function loadCurrentList() {
            jq("#omen-current-list").empty();
            OMEN.currentList(omenInfo.sessionToken).then(res => {
                let resp = res.response;
                let list = resp.result.collection;
                jq("#omen-current-list").append(`<li >数量: ${list.length}</li>`);

                list.forEach(item => {
                    let id = `${item.challengeStructureId}|${item.prize.campaignId}`
                    jq("#omen-current-list").append(`<li >${item.prize.displayName} - ${item.displayName}    <button id="${id}" data-eventname="${item.relevantEvents[0]}">做任务（${item.progressPercentage}%）</button><button id="${id}_auto" data-eventname="${item.relevantEvents[0]}">自动做任务</button>`)
                    // 监听事件
                    document.getElementById(id).addEventListener("click", (e) => {
                        let time = prompt('请输入任务执行时间(单位:分钟)：');

                        OMEN.doIt(omenInfo.sessionToken, e.target.dataset.eventname, parseInt(time)).then(res => {
                            const resp = res.response;
                            const progress = resp.result[0].progressPercentage;
                            if (res.status === 200) {
                                document.getElementById(e.target.id).innerText = `做任务（${progress}%）`
                                if (progress === 100) document.getElementById(e.target.id).parentElement.remove()
                            } else {
                                alert("失败，详细信息在控制台");
                            }
                        })
                    })
                    // 点击“自动执行”事件
                    document.getElementById(id + "_auto").addEventListener("click", (e) => {
                        TASK.add(`${omenInfo.sessionToken}|${e.target.dataset.eventname}|${omenInfo.email}`);
                        document.getElementById(id + "_auto").disabled = true;
                        alert("添加完毕");
                    })
                })
            }).catch(err => {
                console.log(err);
                const errD = err.error;
                if (errD.code === 603 && errD.message === "Session is not valid") {
                    sessionTokenUpdate();
                }
            });
        }
        function loadPrizeList(viewId) {
            jq("#" + viewId + ">.pending").empty();
            jq("#" + viewId + ">.won").empty();
            jq("#" + viewId + ">.other").empty();

            const prizeTypeHandle = (prize) => {
                switch (prize.category) {
                    case "sweepstake":
                        if (prize.drawing.state === "pending") {
                            jq("#" + viewId + ">.pending").append(`<li>${prize.drawing.state}: [${prize.drawing.winner ? "赢得" : "未赢得"}] ${prize.displayName} - 开奖时间：${prize.drawing.drawDate}</li>`)
                        } else if (prize.drawing.state === "drawn" && prize.drawing.winner) {
                            // jq("#" + viewId +">.won").append(`<li>${prize.drawing.state}: [${prize.drawing.winner?"赢得":"未赢得"}] ${prize.displayName} - 开奖时间：${prize.drawing.drawDate}</li>`)
                        } else {
                            jq("#" + viewId + ">.other").append(`<li>${prize.drawing.state}: [${prize.drawing.winner ? "赢得" : "未赢得"}] ${prize.displayName} - 开奖时间：${prize.drawing.drawDate}</li>`)
                        }
                        break;
                    case "sweepstake_prize":
                        jq("#" + viewId + ">.won").append(`<li>赢得：${prize.displayName} - 密钥：${prize.formattedToken.code} - 兑换链接：<a href="${prize.formattedToken.url}" target="_blank">直达</a></li>`)
                        break;
                    case "general":
                        if (prize.formattedToken.format === "text") {
                            jq("#" + viewId + ">.won").append(`<li>赢得：${prize.displayName} - 密钥：${prize.formattedToken.token} </li>`)
                        } else if (prize.formattedToken.format === "code_and_url") {
                            jq("#" + viewId + ">.won").append(`<li>赢得：${prize.displayName} - 密钥：${prize.formattedToken.code} - 兑换链接：<a href="${prize.formattedToken.url}" target="_blank">直达</a></li>`)
                        }
                        break;
                    default:
                        console.log("未知类型", prize);
                        break;
                }
            }
            const getList = (session, page) => {
                return OMEN.prizeList(session, page).then(res => {
                    let resp = res.response;
                    let collection = resp.result.collection;
                    collection.forEach(prizeTypeHandle)
                    if (resp.result.currentPageNumber < resp.result.totalPageCount) {
                        return getList(session, resp.result.currentPageNumber + 1)
                    } else {
                        // 页数遍历完毕
                        console.log("遍历完毕 - 当前页数 - ", resp.result.currentPageNumber)

                    }
                }).catch(err => {
                    console.log(err);
                    const errD = err.error;
                    if (errD.code === 603 && errD.message === "Session is not valid") {
                        sessionTokenUpdate();
                    }
                });
            }
            getList(omenInfo.sessionToken, 1);
        }
        function accessTokenUpdate(force = false) {
            if (omenInfo.auth.startTime + omenInfo.auth.expires_in <= parseInt(new Date().getTime() / 1000) || force) {
                jq("#omen-iframe .omen-tokenresult")[0].innerText = "AccessToken刷新中..."
                OMEN.refreshToken(omenInfo.auth.refresh_token).then(res => {
                    console.log(res)
                    res = res.response;
                    if (res.status_code === undefined) {
                        ACCOUNT.set({
                            auth: res,
                            email: omenInfo.email
                        })
                        jq("#omen-iframe .omen-tokenresult")[0].innerText = "AccessToken刷新成功"
                    } else {
                        jq("#omen-iframe .omen-tokenresult")[0].innerText = res.error_description
                    }
                }).catch(err => {
                    console.log("accessTokenUpdate err", err);
                    jq("#omen-iframe .omen-tokenresult")[0].innerText = "如果看不懂后面一串，就重新登录 - " + err.error_description
                })
            } else {
                jq("#omen-iframe .omen-tokenresult")[0].innerText = "AccessToken似乎在有效期内";
            }
        }
        function sessionTokenUpdate() {
            jq("#omen-iframe .omen-sessionresult")[0].innerText = "更新中~";
            return OMEN.getSession(omenInfo.auth.access_token).then(res => {
                console.log(res)
                if (res.status === 200) {
                    jq("#omen-iframe .omen-sessionresult")[0].innerText = omenInfo.sessionToken = res.response.result.sessionId;
                } else {
                    return Promise.reject(res.response.error_description);
                }
            }).catch(err => {
                console.log("err", err)
                jq("#omen-iframe .omen-sessionresult")[0].innerText = "AccessToken可能过期了！请点击“刷新AccessToken”";
            })
        }

        return {
            init: init,
            initIframe: initIframe,
            showLoading: showLoading,
            hideLoading: hideLoading,
        }
    })();

    const OMEN = (() => {
        const getToken = (code) => {
            let url = "https://oauth.hpbp.io/oauth/v1/token";
            let json = OMEN_BODY.auth(code);
            var params = Object.keys(json).map(function (key) {
                // body...
                return encodeURIComponent(key) + "=" + encodeURIComponent(json[key]);
            }).join("&");

            return HTTP.POST(url, {
                dataType: "json",
                data: params,
                headers: {
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "User-Agent": "Mozilla/4.0 (compatible; MSIE 5.01; Windows NT 5.0)",
                    "Accept": "application/json",
                    "Except": "100-continue"
                }
            })
        }
        const refreshToken = (refresh_token) => {
            let url = "https://oauth.hpbp.io/oauth/v1/token";
            let json = OMEN_BODY.refreshToken(refresh_token);
            var params = Object.keys(json).map(function (key) {
                // body...
                return encodeURIComponent(key) + "=" + encodeURIComponent(json[key]);
            }).join("&");

            return HTTP.POST(url, {
                dataType: "json",
                data: params,
                headers: {
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "User-Agent": "Mozilla/4.0 (compatible; MSIE 5.01; Windows NT 5.0)",
                    "Accept": "application/json",
                    "Except": "100-continue"
                }
            })
        }
        const getSession = (authorization) => {
            let url = "https://www.hpgamestream.com/api/thirdParty/session/temporaryToken?applicationId=" + ApplicationId
            return HTTP.GET(url, {
                dataType: "json",
                headers: {
                    Authorization: "Bearer " + authorization
                }
            }).then(res => {
                console.log(res)
                if (res.status === 200) {

                    return RPCRequest(OMEN_BODY.handShake(res.response.token))
                } else {
                    return Promise.reject(res)
                }
            }).then(res => {
                console.log(res)
                res = res.response;
                return RPCRequest(OMEN_BODY.start(res.result.token, res.result.players[0].externalPlayerId));
            })
        }
        const getUserinfo = (authorization) => {
            // https://api.hpbp.io/user/v1/users/me
            let url = "https://api.hpbp.io/user/v1/users/me"
            return HTTP.GET(url, {
                dataType: "json",
                headers: {
                    Authorization: "Bearer " + authorization,
                    "X-HPBP-Tenant-ID": "omencc-prod"
                }
            })
        }
        const getChallengeList = (session) => {
            return RPCRequest(OMEN_BODY.challengeList(session))
        }
        const join = (session, challengeStructureId, campaignId) => {
            return RPCRequest(OMEN_BODY.join(session, challengeStructureId, campaignId));
        }
        const currentList = (session) => {
            return RPCRequest(OMEN_BODY.current(session));
        }
        const doIt = (session, eventName, time) => {
            return RPCRequest(OMEN_BODY.doIt(session, eventName, time))
        }
        const prizeList = (session, page = 1) => {
            return RPCRequest(OMEN_BODY.prize(session, page));
        }
        const RPCRequest = (params) => {
            return HTTP.POST("https://rpc-prod.versussystems.com/rpc", {
                dataType: "json",
                data: JSON.stringify(params),
                headers: {
                    "content-type": "application/json; charset=UTF-8",
                    "User-Agent": ""
                }
            })
        }

        return {
            getToken: getToken,
            refreshToken: refreshToken,
            getSession: getSession,
            getUserinfo: getUserinfo,
            getChallengeList: getChallengeList,
            join: join,
            currentList: currentList,
            doIt: doIt,
            prizeList: prizeList,
        }
    })();
    const OMEN_BODY = (() => {
        const ClientId = "130d43f1-bb22-4a9c-ba48-d5743e84d113";
        const applicationId = "6589915c-6aa7-4f1b-9ef5-32fa2220c844";

        const basic = {
            "jsonrpc": "2.0",
            "method": null,
            "id": applicationId,
            "params": {
                "sessionToken": null,
                "applicationId": applicationId,
                "sdk": "custom01",
                "sdkVersion": "3.0.0",
                "appDefaultLanguage": "en",
                "userPreferredLanguage": "en"
            }
        }
        const auth = (code) => {
            return {
                grant_type: "authorization_code",
                code: code,
                client_id: ClientId,
                redirect_uri: "http://localhost:9081/login"
            }
        }

        const refreshToken = (refresh_token) => {
            return {
                grant_type: "refresh_token",
                refresh_token: refresh_token,
                client_id: ClientId,
            }
        }
        const handShake = (token) => {
            let body = JSON.parse(JSON.stringify(basic));
            body.method = "mobile.accounts.v1.handshake";
            body.params.userToken = token;
            body.params.Birthdate = "2001-01-02";
            body.params.page = 1;
            body.params.pageSize = 10;
            return body;
        }
        const start = (token, externalPlayerId) => {

            //let uinfo = JSON.parse(window.atob(omenAuth.access_token.split(".")[1]))
            //body.params.accountToken = token;
            //body.params.externalPlayerId = uinfo.hpid_user_id;
            return {
                "jsonrpc": "2.0",
                "id": ApplicationId,
                "method": "mobile.sessions.v2.start",
                "params": {
                    "accountToken": token,
                    "applicationId": ApplicationId,
                    "externalPlayerId": externalPlayerId,
                    "eventNames": [
                        "PLAY:OVERWATCH",
                        "PLAY:HEROES_OF_THE_STORM",
                        "PLAY:FORTNITE",
                        "PLAY:THE_DIVISION",
                        "PLAY:THE_DIVISION_2",
                        "PLAY:PUBG",
                        "PLAY:APEX_LEGENDS",
                        "PLAY:CS_GO",
                        "PLAY:LEAGUE_OF_LEGENDS",
                        "PLAY:DOTA_2",
                        "PLAY:SMITE",
                        "PLAY:AGE_OF_EMPIRES_2",
                        "PLAY:STARCRAFT_2",
                        "PLAY:COMPANY_OF_HEROES_2",
                        "PLAY:ASSASSINS_CREED_ODYSSEY",
                        "PLAY:WORLD_OF_WARCRAFT",
                        "PLAY:WORLD_OF_WARCRAFT_CLASSIC",
                        "PLAY:SPOTIFY",
                        "PLAY:RINGS_OF_ELYSIUM",
                        "PLAY:HEARTHSTONE",
                        "PLAY:GARRYS_MOD",
                        "PLAY:GOLF_IT",
                        "PLAY:DECEIT",
                        "PLAY:SEVEN_DAYS_TO_DIE",
                        "PLAY:DOOM_ETERNAL",
                        "PLAY:STARWARS_JEDI_FALLEN_ORDER",
                        "PLAY:MINECRAFT",
                        "PLAY:DEAD_BY_DAYLIGHT",
                        "PLAY:NETFLIX",
                        "PLAY:HULU",
                        "PLAY:PATH_OF_EXILE",
                        "PLAY:WARTHUNDER",
                        "PLAY:CALL_OF_DUTY_MODERN_WARFARE",
                        "PLAY:ROCKET_LEAGUE",
                        "PLAY:NBA_2K20",
                        "PLAY:STREET_FIGHTER_V",
                        "PLAY:DRAGON_BALL_FIGHTER_Z",
                        "PLAY:GEARS_OF_WAR_5",
                        "PLAY:FIFA_20",
                        "PLAY:MASTER_CHIEF_COLLECTION",
                        "PLAY:RAINBOW_SIX",
                        "PLAY:UPLAY",
                        "PLAY:ROBLOX",
                        "VERSUS_GAME_API:TEAMFIGHT_TACTICS:GOLD_LEFT",
                        "VERSUS_GAME_API:TEAMFIGHT_TACTICS:TIME_ELIMINATED",
                        "VERSUS_GAME_API:TEAMFIGHT_TACTICS:THIRD_PLACE_OR_HIGHER",
                        "VERSUS_GAME_API:TEAMFIGHT_TACTICS:SECOND_PLACE_OR_HIGHER",
                        "VERSUS_GAME_API:TEAMFIGHT_TACTICS:PLAYERS_ELIMINATED",
                        "VERSUS_GAME_API:TEAMFIGHT_TACTICS:TOTAL_DAMAGE_TO_PLAYERS",
                        "PLAY:MONSTER_HUNTER_WORLD",
                        "PLAY:WARFRAME",
                        "PLAY:LEGENDS_OF_RUNETERRA",
                        "PLAY:VALORANT",
                        "PLAY:CROSSFIRE",
                        "PLAY:PALADINS",
                        "PLAY:TROVE",
                        "PLAY:RIFT",
                        "PLAY:ARCHEAGE",
                        "PLAY:IRONSIGHT",
                        "GAMIGO_PLACEHOLDER",
                        "PLAY:TWINSAGA",
                        "PLAY:AURA_KINGDOM",
                        "PLAY:SHAIYA",
                        "PLAY:SOLITAIRE",
                        "PLAY:TONY_HAWK",
                        "PLAY:AVENGERS",
                        "PLAY:FALL_GUYS",
                        "PLAY:QQ_SPEED",
                        "PLAY:FIFA_ONLINE_3",
                        "PLAY:NBA2KOL2",
                        "PLAY:DESTINY2",
                        "PLAY:AMONG_US",
                        "PLAY:MAPLE_STORY",
                        "PLAY:ASSASSINS_CREED_VALHALLA",
                        "PLAY:FREESTYLE_STREET_BASKETBALL",
                        "PLAY:CRAZY_RACING_KART_RIDER",
                        "PLAY:COD_BLACK_OPS_COLD_WAR",
                        "PLAY:CYBERPUNK_2077",
                        "PLAY:HADES",
                        "PLAY:RUST",
                        "PLAY:GENSHIN_IMPACT",
                        "PLAY:ESCAPE_FROM_TARKOV",
                        "PLAY:RED_DEAD_REDEMPTION_2",
                        "PLAY:CIVILIZATION_VI",
                        "PLAY:VALHEIM",
                        "PLAY:FINAL_FANTASY_XIV",
                        "PLAY:OASIS",
                        "PLAY:CASTLE_CRASHERS",
                        "PLAY:GANG_BEASTS",
                        "PLAY:SPEEDRUNNERS",
                        "PLAY:OVERCOOKED_2",
                        "PLAY:OVERCOOKED_ALL_YOU_CAN_EAT",
                        "PLAY:BRAWLHALLA",
                        "PLAY:STELLARIS",
                        "PLAY:MOUNT_AND_BLADE",
                        "PLAY:EUROPA_UNIVERSALIS",
                        "PLAY:ELDER_SCROLLS_ONLINE",
                        "Launch OMEN Command Center",
                        "Use OMEN Command Center",
                        "OMEN Command Center Macro Created",
                        "OMEN Command Center Macro Assigned",
                        "Mindframe Adjust Cooling Option",
                        "Connect 2 different OMEN accessories to your PC at the same time",
                        "Use Omen Reactor",
                        "Use Omen Photon",
                        "Launch Game From GameLauncher",
                        "Image like From ImageGallery",
                        "Set as background From ImageGallery",
                        "Download image From ImageGallery",
                        "CLAIM:PRIZE",
                        "overwatch",
                        "heroesofthestorm",
                        "heroesofthestorm_x64",
                        "FortniteClient-Win64-Shipping",
                        "FortniteClient-Win64-Shipping_BE",
                        "thedivision",
                        "thedivision2",
                        "TslGame",
                        "r5apex",
                        "csgo",
                        "League of Legends",
                        "dota2",
                        "smite",
                        "AoE2DE_s",
                        "AoK HD",
                        "AoE2DE",
                        "sc2",
                        "s2_x64",
                        "RelicCoH2",
                        "acodyssey",
                        "wow",
                        "wow64",
                        "wow_classic",
                        "wowclassic",
                        "Spotify",
                        "Europa_client",
                        "hearthstone",
                        "hl2",
                        "GolfIt-Win64-Shipping",
                        "GolfIt",
                        "Deceit",
                        "7DaysToDie",
                        "DoomEternal_temp",
                        "starwarsjedifallenorder",
                        "Minecraft.Windows",
                        "net.minecraft.client.main.Main",
                        "DeadByDaylight-Win64-Shipping",
                        "4DF9E0F8.Netflix",
                        "HuluLLC.HuluPlus",
                        "PathOfExileSteam",
                        "PathOfExile_x64Steam",
                        "aces",
                        "modernwarfare",
                        "RocketLeague",
                        "NBA2K20",
                        "StreetFighterV",
                        "RED-Win64-Shipping",
                        "Gears5",
                        "fifa20",
                        "MCC-Win64-Shipping",
                        "MCC-Win64-Shipping-WinStore",
                        "RainbowSix",
                        "RainbowSix_BE",
                        "RainbowSix_Vulkan",
                        "upc",
                        "ROBLOXCORPORATION.ROBLOX",
                        "RobloxPlayerBeta",
                        "VERSUS_GAME_API_TEAMFIGHT_TACTICS_GOLD_LEFT",
                        "VERSUS_GAME_API_TEAMFIGHT_TACTICS_TIME_ELIMINATED",
                        "VERSUS_GAME_API_TEAMFIGHT_TACTICS_THIRD_PLACE_OR_HIGHER",
                        "VERSUS_GAME_API_TEAMFIGHT_TACTICS_SECOND_PLACE_OR_HIGHER",
                        "VERSUS_GAME_API_TEAMFIGHT_TACTICS_PLAYERS_ELIMINATED",
                        "VERSUS_GAME_API_TEAMFIGHT_TACTICS_TOTAL_DAMAGE_TO_PLAYERS",
                        "MonsterHunterWorld",
                        "Warframe.x64",
                        "lor",
                        "valorant-Win64-shipping",
                        "valorant",
                        "crossfire",
                        "Paladins",
                        "trove",
                        "rift_64",
                        "rift_x64",
                        "archeage",
                        "ironsight",
                        "Game",
                        "Game.bin",
                        "glyph_twinsaga",
                        "glyph_aurakingdom",
                        "glyph_shaiya",
                        "Solitaire",
                        "THPS12",
                        "avengers",
                        "Fallguys_client_game",
                        "GameApp",
                        "fifazf",
                        "NBA2KOL2",
                        "destiny2",
                        "Among Us",
                        "MapleStory",
                        "ACValhalla",
                        "FreeStyle",
                        "KartRider",
                        "BlackOpsColdWar",
                        "Cyberpunk2077",
                        "Hades",
                        "RustClient",
                        "GenshinImpact",
                        "EscapeFromTarkov",
                        "EscapeFromTarkov_BE",
                        "RDR2",
                        "CivilizationVI",
                        "valheim",
                        "ffxiv_dx11",
                        "AD2F1837.OMENSpectate",
                        "castle",
                        "Gang Beasts",
                        "SpeedRunners",
                        "Overcooked2",
                        "Overcooked All You Can Eat",
                        "Brawlhalla",
                        "stellaris",
                        "TaleWorlds.MountAndBlade.Launcher",
                        "eu4",
                        "eso64"
                    ],
                    "location": {
                        "latitude": 30.5823078,
                        "longitude": 103.984428
                    },
                    "sdk": "custom01",
                    "sdkVersion": "3.0.0",
                    "appDefaultLanguage": "en",
                    "userPreferredLanguage": "en"
                }
            };
        }

        const challengeList = (session) => {
            let body = JSON.parse(JSON.stringify(basic));
            body.method = "mobile.challenges.v4.list";
            body.params.sessionToken = session;
            body.params.onlyShowEligibleChallenges = true;
            body.params.page = 1;
            body.params.pageSize = 10;
            return body;
        }
        const join = (session, challengeStructureId, campaignId) => {
            let body = JSON.parse(JSON.stringify(basic));
            body.method = "mobile.challenges.v2.join";
            body.params.sessionToken = session;
            body.params.challengeStructureId = challengeStructureId;
            body.params.campaignId = campaignId;
            body.params.timezone = "China Standard Time"
            return body;
        }
        const current = (session) => {
            let body = JSON.parse(JSON.stringify(basic));
            body.method = "mobile.challenges.v2.current";
            body.params.sessionToken = session;
            body.params.page = 1;
            body.params.pageSize = 10;
            return body;
        }
        const doIt = (session, eventName, time) => {
            let body = JSON.parse(JSON.stringify(basic));
            body.method = "mobile.challenges.v2.progressEvent";

            body.params.sessionToken = session;
            const timeObj = doIt_getTime(time)
            body.params.startedAt = timeObj.startedAt;
            body.params.endedAt = timeObj.endedAt;
            body.params.eventName = eventName;
            body.params.value = 1
            body.params.signature = new Signature(body).getSignature()
            return body;
        }
        const doIt_getTime = (time) => {
            const endTime = new Date();
            const endMils = endTime.getTime();
            const startMils = endMils - 1000 * 60 * time;
            const startTime = new Date(startMils);
            return {
                startedAt: startTime.toISOString(),
                endedAt: endTime.toISOString(),
            };
        }

        const prize = (session, page = 1) => {
            let body = JSON.parse(JSON.stringify(basic));
            body.method = "mobile.prizes.v2.list";
            body.params.sessionToken = session;
            body.params.page = page;
            body.params.pageSize = 10;
            return body;
        }

        class Signature {
            constructor(b) {
                this.body = b;
            }
            UUIDtoByteArray(uuid) {
                const text = uuid.replace(/-/g, "");
                const num = text.length / 2;
                const array = new Uint8Array(num);
                for (let i = 0; i < num; i += 1) {
                    const substring = text.substring(i * 2, i * 2 + 2);
                    if (substring.length === 0) {
                        array[i] = 0;
                    } else {
                        array[i] = parseInt(substring, 16);
                    }
                }
                return array;
            }
            getSignature() {
                const array = this.UUIDtoByteArray(this.body.params.applicationId);
                const array2 = this.UUIDtoByteArray(this.body.params.sessionToken);
                const array3 = new Uint8Array(16);
                for (let i = 0; i < 16; i += 1) {
                    if (i < 8) {
                        array3[i] = array[i * 2 + 1];
                    } else {
                        array3[i] = array2[(i - 8) * 2];
                    }
                }
                const text = this.getSignableText();
                const sign = sha256.hmac(array3, text);
                return this.arrayBufferToBase64(sign);
            }
            getSignableText() {
                const text = this.body.params.eventName + this.body.params.startedAt
                    + this.body.params.endedAt + this.body.params.value;
                // const buf = Buffer.from(text, "utf8");
                // const array = new Uint8Array(buf.length);
                // for (let index = 0; index < buf.length; index += 1) {
                //     array[index] = buf[index];
                // }
                return this.stringToByte(text);
            }
            arrayBufferToBase64(array) {
                array = new Uint8Array(array);
                var length = array.byteLength;
                var table = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
                    'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
                    'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
                    'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f',
                    'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
                    'o', 'p', 'q', 'r', 's', 't', 'u', 'v',
                    'w', 'x', 'y', 'z', '0', '1', '2', '3',
                    '4', '5', '6', '7', '8', '9', '+', '/'];
                var base64Str = '';
                for (var i = 0; length - i >= 3; i += 3) {
                    var num1 = array[i];
                    var num2 = array[i + 1];
                    var num3 = array[i + 2];
                    base64Str += table[num1 >>> 2]
                        + table[((num1 & 0b11) << 4) | (num2 >>> 4)]
                        + table[((num2 & 0b1111) << 2) | (num3 >>> 6)]
                        + table[num3 & 0b111111];
                }
                var lastByte = length - i;
                let lastNum1;
                if (lastByte === 1) {
                    lastNum1 = array[i];
                    base64Str += table[lastNum1 >>> 2] + table[((lastNum1 & 0b11) << 4)] + '==';
                } else if (lastByte === 2) {
                    lastNum1 = array[i];
                    var lastNum2 = array[i + 1];
                    base64Str += table[lastNum1 >>> 2]
                        + table[((lastNum1 & 0b11) << 4) | (lastNum2 >>> 4)]
                        + table[(lastNum2 & 0b1111) << 2]
                        + '=';
                }
                return base64Str;
            }
            stringToByte(str) {
                var len, c;
                len = str.length;
                var bytes = [];
                for (var i = 0; i < len; i++) {
                    c = str.charCodeAt(i);
                    if (c >= 0x010000 && c <= 0x10FFFF) {
                        bytes.push(((c >> 18) & 0x07) | 0xF0);
                        bytes.push(((c >> 12) & 0x3F) | 0x80);
                        bytes.push(((c >> 6) & 0x3F) | 0x80);
                        bytes.push((c & 0x3F) | 0x80);
                    } else if (c >= 0x000800 && c <= 0x00FFFF) {
                        bytes.push(((c >> 12) & 0x0F) | 0xE0);
                        bytes.push(((c >> 6) & 0x3F) | 0x80);
                        bytes.push((c & 0x3F) | 0x80);
                    } else if (c >= 0x000080 && c <= 0x0007FF) {
                        bytes.push(((c >> 6) & 0x1F) | 0xC0);
                        bytes.push((c & 0x3F) | 0x80);
                    } else {
                        bytes.push(c & 0xFF);
                    }
                }
                return new Uint8Array(bytes);
            }
        }

        return {
            auth: auth,
            refreshToken: refreshToken,
            challengeList: challengeList,
            handShake: handShake,
            start: start,
            join: join,
            current: current,
            doIt: doIt,
            prize: prize
        }
    })();

    const TASK = (() => {
        let taskData = new Set(JSON.parse(localStorage.getItem("omenTask") || "[]"));
        // 获取监听类型
        let hidden, state, visibilityChange;
        if (typeof document.hidden !== "undefined") {
            hidden = "hidden";
            visibilityChange = "visibilitychange";
            state = "visibilityState";
        } else if (typeof document.mozHidden !== "undefined") {
            hidden = "mozHidden";
            visibilityChange = "mozvisibilitychange";
            state = "mozVisibilityState";
        } else if (typeof document.msHidden !== "undefined") {
            hidden = "msHidden";
            visibilityChange = "msvisibilitychange";
            state = "msVisibilityState";
        } else if (typeof document.webkitHidden !== "undefined") {
            hidden = "webkitHidden";
            visibilityChange = "webkitvisibilitychange";
            state = "webkitVisibilityState";
        }
        // 添加监听器,监听当前是否活动页面
        let checkActive;
        const n = Math.random();


        const canIRun = function () {
            if (document[state] === "visible") {
                console.log("visible");
                // 当前页面可视化，检查其它标签是否有运行
                checkActive = setInterval(() => {
                    console.log("checkRunning");
                    hasTabRuning(n).then((res) => {
                        if (!res) {
                            // 没有运行中的标签
                            console.log("没有运行中的标签")
                            document.removeEventListener(visibilityChange, canIRun);
                            clearInterval(checkActive);
                            setRuning();
                            taskDetail();
                            let tasker = setInterval(taskDetail, 31 * 1000);
                        }

                    });

                }, 2000)
            } else if (document[state] === "hidden") {
                clearInterval(checkActive);
            }
        }

        const taskDetail = () => {
            console.log("自动做任务")
            if (taskData == null) return;

            for (let item of taskData) {
                const info = item.split("|")
                OMEN.doIt(info[0], info[1], 0.5).then(res => {
                    console.log(res);
                    const resp = res.response;
                    let result = resp.result;
                    jq("#omen-log-list > li:nth-child(2)").before(`<li>${info[2]} - 奖品：${result[0].prize.displayName} - 任务：${result[0].displayName} - 进度： ${result[0].progressPercentage}%</li>`)
                    if (result.length === 0 || result[0].progressPercentage === 100) {
                        remove(item);

                        GM_notification({
                            text: `${info[2]} - 奖品：${result[0].prize.displayName} - 任务：${result[0].displayName} - 进度： ${result[0].progressPercentage}%`,
                            title: "Omen脚本通知",
                            image: "",
                            highlight: true,
                            silent: false,
                            timeout: 5,
                            ondone: (e) => {
                                console.log("ondone", e)
                            },
                            onclick: (e) => {
                                console.log("onclick", e)
                            }
                        })
                    }
                }).catch(err => {
                    console.log("err", err);
                    if (err.error.message === "Session is not valid") {
                        GM_notification({
                            text: "SESSION过期",
                            title: "Omen脚本通知",
                            highlight: true,
                            silent: false,
                            timeout: 3,
                        })
                        jq("#omen-log-list > li:nth-child(2)").before(`<li>${item} SESSION过期</li>`)
                        TASK.remove(item);
                    } else {
                        jq("#omen-log-list > li:nth-child(2)").before(`<li>${item} 未知错误</li>`)
                    }
                })
            }
        }
        const add = (item) => {
            taskData.add(item);
            store();
        }
        const remove = (item) => {
            taskData.delete(item)
            store();
        }
        const store = () => {
            let it = taskData.keys();
            const temp = [];
            let t;
            while (!(t = it.next()).done) {
                console.log(t)
                temp.push(t.value)
            }
            localStorage.setItem("omenTask", JSON.stringify(temp));
        }
        const setRuning = () => {
            GM_getTab(function (o) {
                console.log(o)
                o.omenRun = true;
                GM_saveTab(o);
            });
        }
        const setStop = () => {
            GM_getTab(function (o) {
                o.omenRun = false;
                GM_saveTab(o);
            });
        }
        const hasTabRuning = (n) => {
            return new Promise((resolve, reject) => {
                GM_getTabs(tabs => {
                    for (let i in tabs) {
                        if (tabs[i].rand === n) continue;

                        if (tabs[i].omenRun) {
                            resolve(true);
                            return;
                        }
                    }
                    resolve(false);
                });
            })
        }
        const init = () => {
            GM_getTab(function (o) {
                o.rand = n;
                GM_saveTab(o);

                hasTabRuning(n).then(res => {
                    if (res) {
                        // 有标签运行，添加监听
                        document.addEventListener(visibilityChange, canIRun, false);
                    } else {
                        // 没有标签运行
                        setRuning();
                        taskDetail();
                        let tasker = setInterval(taskDetail, 31 * 1000);
                    }
                })
            });
        }
        return {
            add: add,
            remove: remove,
            init: init
        }
    })();

    TASK.init();
    jq(document).ready(() => {

        if (window.location.href.includes("keylol")) {
            UI.init();
        } else if (window.location.href.includes("hp.com")) {
            //jq("script[src='https://static.id.hp.com/login3/static/js/main.ed19e0b4.chunk.js']")[0].remove()

            /* globalThis["RedirectToKeyLol"] = (url)=>{
                 GM_log(url)
                 HTTP.GET("https://task.jysafe.cn/test/r.php?url=" + encodeURIComponent(url)).then(res=>{
                     console.log(res)
                 })
             }*/
        }

    })
})();