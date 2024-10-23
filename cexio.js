const {readfiledata,readquerydata,readproxydata,httpsapi,cmdtitle,sleep,waiting,countdown,nowlog,fNumber,readbotdata,checktaps} = require('./aapi_request.js')
const proxyfile = 'proxy.txt'
const proxylist = readfiledata(proxyfile)

const botname = "CEXIO"
const {queryfile,tokenfile}  = readbotdata(botname)
const queryids = readfiledata(queryfile)

class BOT{
    constructor(){
        this.headers = {
            "accept": "*/*",
            "accept-language": "en,vi;q=0.9,en-US;q=0.8,en-GB;q=0.7,nl;q=0.6",
            "content-type": "application/json",
            "priority": "u=1, i",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "Referer": "https://cexp.cex.io/",
            "x-request-userhash": "3d7830f036092d3f631eb2d123a9c536754b5cca26612136a48d48f99708870c",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        };
    }
    async getuserdata(callHeaders,proxy,payload) {
        const url = `https://cexp.cex.io/api/v2/getUserInfo`;
        try{
            const response = await httpsapi("POST",url,callHeaders,proxy,payload);
            return response.data;
        }catch(error){
            nowlog(`Error Response Data!, ${error.message}`,'error');
            return null
        }
    }
    
    async claimMultitap(callHeaders,proxy,payload,energy,minhits,maxhits,multiTapsPower) {
        const url = `https://cexp.cex.io/api/v2/claimMultiTaps`;
        const maxtaps = (minhits+maxhits) * multiTapsPower
        try{
            while(energy>=maxtaps){
                let taps = (Math.floor(Math.random()*minhits+maxhits-Math.random()*minhits))*multiTapsPower
                if(taps > energy){
                    taps = energy
                }
                payload['data'] = {
                    tapsEnergy: `${energy-taps}`,
                    tapsToClaim: `${taps}`,
                    tapsTs: Date.now()
                };            
                await httpsapi("POST",url,callHeaders,proxy,payload);
                nowlog(`${`[Feed]`.green} Hitting... ${hits} times success`)
                
                energy -= taps+3
                if(energy <= 0){
                    break
                }
                await sleep(1)
            }
            nowlog('Out Of Energy, Stop Tapping...','warning')
        }catch(error){
            nowlog(`Error Taps Data!, ${error.message}`,'error');
        }
    }

    async claimCrypto(callHeaders,proxy,payload) {
        const url = `https://cexp.cex.io/api/v2/claimCrypto`;
        try{
            const response = await httpsapi("POST",url,callHeaders,proxy,payload);
            return response.data;
        }catch(error){
            nowlog(`Error Claim Cryto!, ${error.message}`,'error');
            return null
        }
    }
    async getcardsconfig(callHeaders,proxy,payload) {
        const url = `https://cexp.cex.io/api/v2/getGameConfig`;
        try{
            const response = await httpsapi("POST",url,callHeaders,proxy,payload);
            return response.data.upgradeCardsConfig;
        }catch(error){
            nowlog(`Error Get Config Data!, ${error.message}`,'error');
            return null
        }
    }
    async getcards(callHeaders,proxy,payload) {
        const url = `https://cexp.cex.io/api/v2/getUserCards`;
        try{
            const response = await httpsapi("POST",url,callHeaders,proxy,payload);
            return response.data.cards;
        }catch(error){
            nowlog(`Error Get Cards Data!, ${error.message}`,'error');
            return null
        }
    }
    async buycards(callHeaders,proxy,payload) {
        const url = `https://cexp.cex.io/api/v2/buyUpgrade`;
        try{
            const response = await httpsapi("POST",url,callHeaders,proxy,payload);
            return response.data;
        }catch(error){
            nowlog(`Error Buy Card!, ${error.message}`,'error');
            return null
        }
    }
    async processUpgrades(callHeaders,proxy,payload, balance_USD){
        const cardconfig = await this.getcardsconfig(callHeaders,proxy,payload);
        const cardlists = await this.getcards(callHeaders,proxy,payload);
        for (const category of cardconfig){
            if (category.categorId === "specials"){
                continue
            }
            
            for (const upgrade of category.upgrades) {
                const card = cardlists[upgrade.upgradeId];
                if (upgrade.dependency) {
                    const dependencyCard = cardlists[upgrade.dependency.upgradeId];
                    if (dependencyCard && Object.keys(dependencyCard).length > 0 && dependencyCard.lvl < upgrade.dependency.level) {
                        continue
                    }
                }

                const level = card ? card.lvl : 0;
                if (level < upgrade.levels.length) {
                    const nextLevel = level + 1;
                    const [cost, ccy, effect, effectCcy] = upgrade.levels[level];
                    if (ccy === "USD" && balance_USD < cost) {
                        continue
                    }
                    payload['data'] = {
                        categoryId: category.categoryId,
                        upgradeId: upgrade.upgradeId,
                        nextLevel: nextLevel,
                        cost: cost, 
                        ccy: ccy, 
                        effect: effect, 
                        effectCcy: effectCcy
                    };
                    const response = await this.buycards(callHeaders,proxy,payload);
                    if(response){
                        nowlog(`Upgrade Card ${upgrade.upgradeName} lvl ${nextLevel}`);
                        balance_USD -= cost;
                    }
                    await sleep(1)
                }    
            }
        }
    }

    async getConvertData(callHeaders,proxy,payload) {
        const url = `https://cexp.cex.io/api/v2/getConvertData`;
        try{
            const response = await httpsapi("POST",url,callHeaders,proxy,payload);
            return response.data;
        }catch(error){
            nowlog(`Error Convert Data!, ${error.message}`,'error');
            return null
        }
    }
    async convertCryto(callHeaders,proxy,payload,balance_BTC) {
        const url = `https://cexp.cex.io/api/v2/convert`;
        const response = await this.getConvertData(callHeaders,proxy,payload)
        const lastPrice = response.convertData.lastPrices[response.convertData.lastPrices.length - 1];
        balance_BTC = balance_BTC;
        payload['data'] = {fromCcy: "BTC", toCcy: "USD", fromAmount: balance_BTC, price: lastPrice};
        try{
            const response = await httpsapi("POST",url,callHeaders,proxy,payload);
            return response.data;
        }catch(error){
            nowlog(`Error Convert Data!, ${error.message}`,'error');
            return null
        }
    }

// PROCESS TASK    
    async getspecOffer(callHeaders,proxy,payload) {
        const url = `https://cexp.cex.io/api/v2/getUserSpecialOffer`;
        try{
            const response = await httpsapi("POST",url,callHeaders,proxy,payload);
            nowlog('Getting Offer Data...!','success')
            if(response.data.data.length === 0){
                nowlog('No Offer Data...!','warning')
            }
            return response.data.data;
        }catch(error){
            nowlog(`Error Get Offer Data!, ${error.message}`,'error');
            return null
        }
    }
    async startspecOffer(callHeaders,proxy,payload,specialOfferId) {
        const url = `https://cexp.cex.io/api/v2/startUserSpecialOffer`;
        payload['data'] = {"specialOfferId": `${specialOfferId}`}
        try{
            const response = await httpsapi("POST",url,callHeaders,proxy,payload);
            nowlog(`Start Offer Task ${specialOfferId}!`,'warning')
            return response.data.data;
        }catch(error){
            nowlog(`Error Start Offer Data!, ${error.message}`,'error');
            return null
        }
    }
    async checkspecOffer(callHeaders,proxy,payload,specialOfferId) {
        const url = `https://cexp.cex.io/api/v2/checkUserSpecialOffer`;
        payload['data'] = {"specialOfferId": `${specialOfferId}`}
        try{
            const response = await httpsapi("POST",url,callHeaders,proxy,payload);
            nowlog(`Checking Offer Task ${specialOfferId}!`,'warning')
            return response.data.data;
        }catch(error){
            nowlog(`Error Check-Claim Offer Data!, ${error.message}`,'error');
            return null
        }
    }
    async claimspecOffer(callHeaders,proxy,payload,specialOfferId) {
        const url = `https://cexp.cex.io/api/v2/claimUserSpecialOffer`;
        payload['data'] = {"specialOfferId": `${specialOfferId}`}
        try{
            const response = await httpsapi("POST",url,callHeaders,proxy,payload);
            nowlog(`Claim Offer Task ${specialOfferId} Done!`,'warning')
            return response.data.data;
        }catch(error){
            nowlog(`Error Claim Offer Data!, ${error.message}`,'error');
            return null
        }
    }
    async gettask(callHeaders,proxy,payload) {
        const url = `https://cexp.cex.io/api/v2/getUserTasks`;
        try{
            const response = await httpsapi("POST",url,callHeaders,proxy,payload);
            nowlog('Getting Task Data...!','success')
            return response.data.tasks;
        }catch(error){
            nowlog(`Error Get Tasks Data!, ${error.message}`,'error');
            return null
        }
    }
    async starttask(callHeaders,proxy,payload,taskId) {
        const url = `https://cexp.cex.io/api/v2/startTask`;
        payload['data'] = {"taskId": `${taskId}`}
        try{
            const response = await httpsapi("POST",url,callHeaders,proxy,payload);
            nowlog(`Start Task ${taskId}!`,'warning')
            return response.data.data.state;
        }catch(error){
            nowlog(`Error Start Task Data!, ${error.message}`,'error');
            return null
        }
    }
    async checktask(callHeaders,proxy,payload,taskId) {
        const url = `https://cexp.cex.io/api/v2/checkTask`;
        payload['data'] = {"taskId": `${taskId}`}
        try{
            const response = await httpsapi("POST",url,callHeaders,proxy,payload);
            nowlog(`Checking... Task ${taskId}!`,'warning')
            return response.data.data.state;
        }catch(error){
            nowlog(`Error Check-Claim Offer Data!, ${error.message}`,'error');
            return null
        }
    }
    async claimtask(callHeaders,proxy,payload,taskId) {
        const url = `https://cexp.cex.io/api/v2/claimTask`;
        payload['data'] = {"taskId": `${taskId}`}
        try{
            const response = await httpsapi("POST",url,callHeaders,proxy,payload);
            nowlog(`Claim Task ${taskId} Success`,'warning')
            return response.data.data.state;
        }catch(error){
            nowlog(`Error Claim Claim Task!, ${error.message}`,'error');
            return null
        }
    }

    async processTask(callHeaders,proxy,payload){
        const skiptasks = [
            "invite_1_friend",
            "invite_5_friends",
            "invite_10_friends",
            "invite_20_friends",
            "invite_50_friends",
            "invite_100_friends",
            "invite500Friends",
            "invite1000Friends"
        ]
        const speclist = await this.getspecOffer(callHeaders,proxy,payload)
        for (let specOffertask of speclist){
            let {state,specialOfferId} = specOffertask
            if(state === "NONE"){
                await this.startspecOffer(callHeaders,proxy,payload,specialOfferId)
            }else if(state === "ReadyToCheck"){
                state = await this.checkspecOffer(callHeaders,proxy,payload,specialOfferId)
            }

            if(state === "ReadyToClaim"){
                await this.claimspecOffer(callHeaders,proxy,payload,taskId)
            }
            await sleep(1)
        }
        await waiting(5,botname)

        const responseTasks = await this.gettask(callHeaders,proxy,payload)
        const responseRevise = Object.keys(responseTasks).map(key => {
            return {taskId: key, ...responseTasks[key]};
        })
        const tasklist = responseRevise.filter(task => task.state)
        for (let task of tasklist){
            let {state,taskId} = task
            if(skiptasks.includes(taskId)){
                continue
            }

            if(state === "NONE"){
                await this.starttask(callHeaders,proxy,payload,taskId)
            }else if(state === "ReadyToCheck"){
                state = await this.checktask(callHeaders,proxy,payload,taskId)
            }

            if(state === "ReadyToClaim"){
                await this.claimtask(callHeaders,proxy,payload,taskId)
            }
            await sleep(1)
        }
    }   

    async main() {
        await countdown(5,botname)
        while(true){
            for(let i = 0; i < queryids.length; i++){
                const {user,queryid}= readquerydata(queryids,i);
                const proxy = await readproxydata(proxylist,i)
                nowlog(`${botname} BOT: Run User[${i+1}] - ID: ${user.id}`,'special')
                cmdtitle(user.id,botname)
                const payload ={
                    "devAuthData": user.id,
                    "authData": queryid,
                    "platform": "android",
                    "data": {}
                };
                const callHeaders = this.headers
                try{
                    const responseData = await this.getuserdata(callHeaders,proxy,payload)
                    const {balance_CEXP,balance_USD,multiTapsEnergyLimit,multiTapsPower,multiTapsEnergy} = responseData.data
                    const {data} = await this.claimCrypto(callHeaders,proxy,payload)
                    const updatebalanceBTC = data.BTC.balance_BTC/1e4

                    nowlog(`[Balance CEXP]: ${fNumber(balance_CEXP).magenta}`);
                    nowlog(`[Balance BTC] : ${fNumber(updatebalanceBTC).green}`);
                    nowlog(`[Balance USD] : ${fNumber(balance_USD).green}`);

                    await waiting(5,botname)
                    //await this.processTask(callHeaders,proxy,payload)

                    if (updatebalanceBTC > 100){
                        await this.convertCryto(callHeaders,proxy,payload,updatebalanceBTC)
                    }
                    await sleep(3)
                    await this.processUpgrades(callHeaders,proxy,payload,balance_USD)
                    //await this.claimMultitap(callHeaders,proxy,payload,multiTapsEnergyLimit,5,25,multiTapsPower)
                } catch (error) {
                    nowlog(`Error Get Data User ${user.id}!, ${error.message}`,'error');
                    await waiting(5,botname)
                }
            }
            await countdown(10900,botname)            
        } 
    }
}

if (require.main === module) {
    const bot = new BOT();
    bot.main().catch(error => {
        nowlog(`${error.message}`,'error');
    });
}