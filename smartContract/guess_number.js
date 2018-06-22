'use strict';

var GuessNumberContract = function () {
    LocalContractStorage.defineMapProperty(this, "guessList");
    LocalContractStorage.defineMapProperty(this, "guessConfig");
    LocalContractStorage.defineMapProperty(this, "guessMap");
    LocalContractStorage.defineMapProperty(this, "addressGuessInfo");
    LocalContractStorage.defineMapProperty(this, "addressGuessNums");
    LocalContractStorage.defineMapProperty(this, "addressGuessIndex");

    LocalContractStorage.defineMapProperty(this, "myPlayedNums");
    LocalContractStorage.defineMapProperty(this, "myPlayedIndex");

    LocalContractStorage.defineMapProperty(this, "addressInfo");
    LocalContractStorage.defineProperty(this, "size");

    LocalContractStorage.defineProperty(this, "adminAddress")
    LocalContractStorage.defineProperty(this, "MinPostNas")

};

GuessNumberContract.prototype = {
    init: function () {
        this.size = 0
        this.MinPostNas = 0.001
        var config = {
            mainnet: {
                admin: "n1X5tQyqNtWNZzXA5WzrbBAZktmGYE3jduj"
            },
            testnet: {
                admin: "n1J5YqDGzXbGNUwW9asuh4py2sjHr86XyHr"
            }
        }
        var runEnv = "mainnet"
        var envConfig = config[runEnv]
        this.adminAddress = envConfig.admin
    },
    // 保存猜一猜信息
    save: function (guessArg) {
        var index = this.size
        var key = Blockchain.transaction.hash
        var fromUser = Blockchain.transaction.from

        if (isNaN(guessArg.number)) {
            throw new Error("10012")
        }

        if (isNaN(guessArg.nas)) {
            throw new Error("10013")
        }

        // var guessArg = guess
        var digits = guessArg.number.toString().length

        if (digits < 2) {
            throw new Error("10000")
        }

        // 需要判断交易nas是否 >= 竞猜 NAS
        var sendNas = Blockchain.transaction.value / 1000000000000000000

        if (sendNas < this.MinPostNas) {
            throw new Error("10014")
        }

        var transaction_value = new BigNumber(sendNas)
        if (transaction_value.lessThan(new BigNumber(guessArg.nas))) {
            throw new Error("10001")
        }

        if (!(this._checkHasHtml(guessArg.title) && this._checkHasHtml(guessArg.tips))) {
            throw new Error("10011");
        }

        var guessObj = {
            "hash": key,
            "author": fromUser,
            "showDigits": guessArg.showDigits,
            "title": guessArg.title,
            "tips": guessArg.tips,
            "maxTry": parseInt(guessArg.maxTry), //最多几次机会
            "nas": guessArg.nas,
            "created": Blockchain.transaction.timestamp,
            "endTime": parseInt(guessArg.endTime), //结束时间
            "success": null,
            "playUsers": 0, //多少用户试过
            "needPasswd": false,
            "sendNas": sendNas,
        }

        var guessConfig = {
            "number": guessArg.number,
            "digits": digits
        }

        if (guessArg.passwd) {
            guessConfig.passwd = guessArg.passwd
            guessObj.needPasswd = true
        }

        this.guessConfig.set(key, guessConfig)
        this.guessList.set(index, key);
        this.guessMap.set(key, guessObj);

        //记录每个地址添加的总数
        var addressGuessNums = this.addressGuessNums.get(fromUser)
        if (!addressGuessNums) {
            addressGuessNums = 0
        }
        this.addressGuessNums.set(fromUser, addressGuessNums + 1)

        //记录每个所以处对应的hash
        this.addressGuessIndex.set(fromUser + "." + addressGuessNums, key)

        this.size += 1;
        return this.size
    },
    _checkHasHtml: function (str) {
        if (str.indexOf("<") != -1 || str.indexOf(">") != -1 || /<\s*script\s*>/.test(str)) {
            return false
        }
        return true
    },
    setProfile: function (profile) {
        var fromUser = Blockchain.transaction.from
        var info = this.addressInfo.get(fromUser)
        if (!info) {
            info = {}
        }
        if (!this._checkHasHtml(profile.nickName)) {
            return new Error("10011");
        }
        info.nickName = profile.nickName
        this.addressInfo.set(fromUser, info)
        return info
    },
    getProfile: function (address) {
        if (!address) {
            address = Blockchain.transaction.from
        }
        var info = this.addressInfo.get(address)
        return info
    },
    addressSize: function (address) {
        if (!address) {
            address = Blockchain.transaction.from
        }
        return this.addressGuessNums.get(fromUser)
    },
    //获取发布时最小需要的 nas
    getMinPostNas: function () {
        return this.MinPostNas
    },
    //设置发布时最小需要的 nas
    setMinPostNas: function (nas) {
        var fromUser = Blockchain.transaction.from
        if (fromUser != this.adminAddress) {
            return new Error("403");
        }
        this.MinPostNas = nas
    },
    size: function () {
        return this.size
    },
    // 获取猜一猜信息
    getGuess: function (txid) {
        var guess = this.guessMap.get(txid);
        var fromUser = Blockchain.transaction.from
        if (!guess) {
            return null
        }
        var isAdmin = fromUser == guess.author
        var showDigits = guess.showDigits
        if (!(isAdmin || showDigits)) {
            return guess;
        }
        var config = this.guessConfig.get(txid)
        if (!config) {
            return guess
        }
        if (isAdmin) {
            guess.config = config
        } else if (showDigits) {
            guess.config = {
                digits: config.digits
            }
        }

        var addressInfo = this.addressInfo.get(guess.author)
        if (addressInfo) {
            guess.user = {
                nickName: addressInfo.nickName
            }
        }

        return guess
    },
    // 获取玩过的猜一猜信息列表
    getPlayedGuess: function (limit, offset) {

        var fromUser = Blockchain.transaction.from

        var result = {
            total: 0,
            guess: []
        }

        var total = this.myPlayedNums.get(fromUser) * 1
        result.total = total

        if (offset == -1) {
            offset = total
        }

        for (var i = 0; i < limit; i++) {
            var index = offset - i - 1;
            if (index < 0) {
                break
            }
            var played = this.myPlayedIndex.get(fromUser + "." + index)
            if (!played) {
                continue
            }
            var txid = played.hash
            var guess = this.guessMap.get(txid);
            if (guess) {
                this._guessAttaInfo(guess)
                result.guess.push(guess)
            }

            if (index <= 0) {
                break
            }
        }

        return result
    },
    // 获取某一个的猜一猜信息列表
    getAddressGuess: function (limit, offset, address) {
        if (!address) {
            address = Blockchain.transaction.from
        }

        var result = {
            total: 0,
            guess: []
        }

        var total = this.addressGuessNums.get(address) * 1
        result.total = total

        if (offset == -1) {
            offset = total
        }

        for (var i = 0; i < limit; i++) {
            var index = offset - i - 1;
            if (index < 0) {
                break
            }
            var key = this.addressGuessIndex.get(address + "." + index)
            var guess = this.guessMap.get(key);
            if (!guess) {
                continue
            }
            if (guess) {
                this._guessAttaInfo(guess)
                result.guess.push(guess)
            }

            if (index == 0) {
                break
            }
        }

        return result
    },
    _guessAttaInfo: function (guess) {
        if (!guess) {
            return
        }

        var fromUser = Blockchain.transaction.from

        var isAdmin = fromUser == guess.author
        var showDigits = guess.showDigits
        if (isAdmin || showDigits) {
            var txid = guess.hash
            var config = this.guessConfig.get(txid)
            if (config) {
                if (isAdmin) {
                    guess.config = config
                } else if (showDigits) {
                    guess.config = {
                        digits: config.digits
                    }
                }
            }
        }

        var addressInfo = this.addressInfo.get(guess.author)
        if (addressInfo) {
            guess.user = {
                nickName: addressInfo.nickName
            }
        }
    },
    forEach: function (limit, offset) {
        limit = parseInt(limit);
        offset = parseInt(offset);
        if (offset > this.size) {
            throw new Error("10002");
        }
        if (offset == -1) {
            offset = this.size
        }
        var result = {
            total: this.size,
            guess: []
        }
        for (var i = 0; i < limit; i++) {
            var index = offset - i - 1;
            if (index < 0) {
                break
            }
            var key = this.guessList.get(index);
            var guess = this.guessMap.get(key);
            if (guess) {
                this._guessAttaInfo(guess)

                result.guess.push(guess)
            }

            if (index == 0) {
                break
            }
        }
        return result
    },
    // 验证猜一猜
    verifyNumber: function (txid, info) {
        // info:{"passwd":"可能有","number":""}
        var fromUser = Blockchain.transaction.from
        var hash = Blockchain.transaction.hash

        var guessInfo = this.getGuess(txid)
        if (!guessInfo) {
            throw new Error("10003");
        }

        if (guessInfo.author == fromUser) {
            throw new Error("10009");
            return
        }

        var guessConfig = this.guessConfig.get(txid)

        if (!guessConfig) {
            throw new Error("10008");
        }

        var timestamp = Blockchain.transaction.timestamp

        if (guessInfo.endTime < timestamp) {
            throw new Error("10010");
        }

        if (guessInfo.success) {
            throw new Error("10006");
        }

        guessInfo.playUsers += 1
        this.guessMap.set(txid, guessInfo);

        //记录我参与过的
        var myPlayedNums = this.myPlayedNums.get(fromUser) * 1
        this.myPlayedNums.set(fromUser, myPlayedNums + 1)

        var myPlayedIndex = {
            hash: txid,
            created: timestamp,
            success: false,
            value: 0
        }
        this.myPlayedIndex.set(fromUser + "." + myPlayedNums, myPlayedIndex)


        var key = fromUser + "." + txid

        if (guessInfo.maxTry) {
            var nums = this.addressGuessInfo.get(key)
            if (nums >= guessInfo.maxTry) {
                throw new Error("10007");
            }
            this.addressGuessInfo.set(key, nums + 1)
        }

        if (guessInfo.needPasswd && (guessConfig.passwd != info.passwd)) {
            throw new Error("10004");
        }

        if (guessConfig.number != info.number) {
            throw new Error("10005");
        }

        // 如果正确还需要标记已经完成了
        guessInfo.success = {
            "author": fromUser,
            "created": Blockchain.transaction.timestamp,
            "hash": hash
        }

        this.guessMap.set(txid, guessInfo);

        // return Blockchain.transaction.value

        // 如果验证成功则发送 NAS 到获奖者
        var send_value = guessInfo.nas * 0.95

        myPlayedIndex.success = true
        myPlayedIndex.value = send_value

        this.myPlayedIndex.set(fromUser + "." + myPlayedNums, myPlayedIndex)

        var amount = new BigNumber(send_value * 1000000000000000000)
        // var amount = new BigNumber(1 * 1000000000000000000)
        var result = this._transfer(fromUser, amount)
        return [guessInfo.nas, send_value, result]
        // if (result == 0) {
        //     return true
        // }
        // return false
    },
    withdraw: function (address, value) {
        var fromUser = Blockchain.transaction.from

        if (fromUser == this.adminAddress && Blockchain.verifyAddress(address)) {
            var amount = new BigNumber(value * 1000000000000000000)
            var result = Blockchain.transfer(address, amount);
            return result
        }
        throw new Error("403");
    },
    //取回NAS
    withdrawGuess: function (txid) {
        var fromUser = Blockchain.transaction.from
        var guess = this.guessMap.get(txid);
        //检查是不是自己的
        if (guess && fromUser == guess.author) {
            //检查是否已过期,过期后才能取回
            var now = new Date(),
                ts = parseInt(now.getTime() / 1000);
            if (guess.endTime < now) {
                // 取回后增加标识
                var config = this.guessConfig.get(txid)

                if (config.retrieve) {
                    throw new Error("10016");
                }

                var retrieveNas = guess.nas * 0.95

                config.retrieve = true
                config.retrieveNas = retrieveNas

                this.guessConfig.set(txid, config)

                var result = Blockchain.transfer(fromUser, retrieveNas * 1000000000000000000);
                return result
            } else {
                throw new Error("10015");
            }
        } else {
            throw new Error("403");
        }
    },
    _transfer: function (address, value) {
        var result = Blockchain.transfer(address, value);
        // console.log("transfer result:", result);
        // Event.Trigger("transfer", {
        //     Transfer: {
        //         from: Blockchain.transaction.to,
        //         to: address,
        //         value: value
        //     }
        // });
        return result
    }
};

module.exports = GuessNumberContract;