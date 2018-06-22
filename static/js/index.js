var nebulas = require("nebulas"),
    HttpRequest = nebulas.HttpRequest,
    Neb = nebulas.Neb,
    Account = nebulas.Account,
    Transaction = nebulas.Transaction,
    Unit = nebulas.Unit,
    Utils = nebulas.Utils,
    nebPay = require("nebPay");


var chainnetConfig = {
    mainnet: {
        name:"主网",
        contractAddress: "n1woUX7dF6BMJ4u8JyWmvbGg3NiSSzjWAwk",
        txhash: "390f720b91f14df9c47eebee27a5296addf35a97971e5017ab6df14045c45ee6",
        host: "https://mainnet.nebulas.io"
    },
    testnet: {
        name:"测试网",
        contractAddress: "n1eZZeXkNnYzJNzhxLyWimujGAUbjmUVHSJ",
        txhash: "eaa8bdca6cbb3b8ee5c438ec8af45c53dd5e37a14c4547dacffb10d02257f0af",
        host: "https://testnet.nebulas.io"
    }
}

var chain = localStorage.getItem("chain")||"mainnet"
var chainInfo = chainnetConfig[chain]

var neb = new Neb();
neb.setRequest(new HttpRequest(chainInfo.host));

var nasApi = neb.api;

Vue.prototype.nebPay = nebPay


function getErrMsg(err) {
    var msg = ""
    if (err == 'Call: Error: 10000') {
        msg = "竞猜数字最少必须是2位数"
    }else if (err == 'Call: Error: 403') {
        msg = "权限禁止"
    } else if (err == 'Call: Error: 10001') {
        msg = "交易额必须大于等于竞猜 NAS"
    } else if (err == 'Call: Error: 10002') {
        msg = "offset参数错误"
    } else if (err == 'Call: Error: 10003') {
        msg = "竞猜详情未找到"
    } else if (err == 'Call: Error: 10004') {
        msg = "密码错误"
    } else if (err == 'Call: Error: 10005') {
        msg = "数字错误"
    } else if (err == 'Call: Error: 10006') {
        msg = "此游戏已完成"
    } else if (err == 'Call: Error: 10007') {
        msg = "超过尝试次数"
    } else if (err == 'Call: Error: 10008') {
        msg = "游戏配置获取失败"
    } else if (err == 'Call: Error: 10009') {
        msg = "不能参加自己发布的游戏"
    } else if (err == 'Call: Error: 10010') {
        msg = "此游戏已过期"
    } else if (err == 'Call: Error: 10011') {
        msg = "参数包含非法标签"
    } else if (err == 'Call: Error: 10012') {
        msg = "number参数错误"
    } else if (err == 'Call: Error: 10013') {
        msg = "猜中奖励 NAS 数量参数错误"
    } else if (err == 'Call: Error: 10014') {
        msg = "发布时最小 NAS 错误"
    } else if (err == 'Call: Error: 10015') {
        msg = "未结束，不能取回 NAS"
    } else if (err == 'Call: Error: 10016') {
        msg = "已取回 NAS"
    }
    return msg
}

var GuessDetailComponent = {
    template: '#guess-detail-tpl',
    watch: {
        '$parent.nebState': function () {
            this.fetchDetail()
        }
    },
    methods: {
        playGuessDialog: function () {
            this.dialogVisible = true
        },
        verifyNumber: function () {
            var _this = this;
            if (!this.$parent.nebState) {
                _this.$message.error("获取节点状态失败！")
                return
            }
            if (!(this.$parent.account && this.$parent.account.getPrivateKey())) {
                _this.$parent.unlockWallectVisible = true
                _this.$message.error("获取钱包信息失败，请加载并解锁你的钱包")
                return
            }

            var args = JSON.stringify([_this.hash, _this.playGuess])
            // var nonce = this.$parent.getNonce()
            nasApi.getAccountState({
                address: this.$parent.account.getAddressString()
            }).then(function (resp) {

                var nonce = resp.nonce * 1 + 1

                var tx = new Transaction({
                    chainID: _this.$parent.nebState.chain_id,
                    from: _this.$parent.account,
                    to: _this.$parent.contractAddress,
                    value: 0,
                    nonce: nonce,
                    gasPrice: 1000000,
                    gasLimit: 2000000,
                    contract: {
                        function: "verifyNumber",
                        args: args
                    }
                });
                tx.signTransaction();
                nasApi.sendRawTransaction({
                    data: tx.toProtoString()
                }).then(function (hash) {
                    _this.dialogVisible = false
                    _this.fetchDetail()
                    _this.$message.success("恭喜你猜中数字，区块可能还在打包！请稍后查看余额和中奖状态！")
                }).catch(function (e) {
                    var m = e.message
                    _this.$message.error(getErrMsg(m))

                })

            })
        },
        submitForm: function (formName) {
            var _this = this

            this.$refs[formName].validate(function (valid) {
                if (valid) {
                    _this.verifyNumber()
                } else {
                    _this.$message.error("表单验证错误！")
                    return false;
                }
            });
        },
        fetchDetail: function () {

            var _this = this;
            if (!this.$parent.nebState) {
                // _this.$message.error("获取节点状态失败！")
                return
            }
            // if (!this.$parent.account) {
            //     _this.$message.error("获取钱包信息失败，请加载并解锁你的钱包")
            //     return
            // }

            var contractAddress = this.$parent.contractAddress
            // var nonce = this.$parent.getNonce()

            nasApi.call({
                chainID: this.$parent.nebState.chain_id,
                from: (this.$parent.account && this.$parent.account.getAddressString()) || contractAddress,
                to: contractAddress,
                value: 0,
                // nonce: nonce,
                gasPrice: 1000000,
                gasLimit: 2000000,
                contract: {
                    function: "getGuess",
                    args: JSON.stringify([this.hash])
                }
            }).then(function (resp) {
                // console.log(resp)
                _this.loading = false
                if (resp.error) {
                    return
                }
                if (resp.execute_err) {
                    return _this.$message.error(resp.execute_err)
                }
                var result = resp.result
                var data = JSON.parse(result)
                if (!data) {
                    _this.$message.warning("未找到此游戏，可能是因为区块还属于 pending 状态！")
                    return
                }
                _this.guess = data
                if (data.needPasswd) {
                    _this.playGuessRules.passwd = {
                        required: true,
                        message: '必须输入密码',
                        trigger: 'blur'
                    }
                }
            })
        }
    },
    created: function () {
        this.fetchDetail()
    },
    data: function () {
        var hash = this.$route.params.id
        return {
            loading: true,
            dialogVisible: false,
            playGuessRules: {
                number: {
                    required: true,
                    message: '必须输入数字',
                    trigger: 'blur'
                },
            },
            playGuess: {
                number: "",
                passwd: "",
            },
            guess: {
                "hash": "",
                "author": "",
                "showDigits": false,
                "title": "",
                "tips": "",
                "maxTry": 0,
                "nas": 0,
                "created": 0,
                "endTime": 1525881600,
                "success": null,
                "playUsers": 0,
                "needPasswd": false,
                "sendNas": 1,
                "config": null

            },
            hash: hash,
        }
    }
}

var SettingComponent = {
    template: '#setting-tpl',
    watch: {
        "$parent.nebState": function (n) {
            this.getProfile()
        },
        "$parent.account": function (n) {
            this.getProfile()
        }
    },
    methods: {
        setProfile: function () {
            var _this = this;
            if (!this.$parent.nebState) {
                _this.$message.error("获取节点状态失败！")
                return
            }
            if (!(this.$parent.account && this.$parent.account.getPrivateKey())) {
                _this.$parent.unlockWallectVisible = true
                _this.$message.error("获取钱包信息失败，请加载并解锁你的钱包")
                return
            }
            //console.log(this.$parent)
            //return 

            nasApi.getAccountState({
                address: this.$parent.account.getAddressString()
            }).then(function (resp) {

                var nonce = resp.nonce * 1 + 1
                var args = JSON.stringify([_this.setting])

                var options = {
                    chainID: _this.$parent.nebState.chain_id,
                    from: _this.$parent.account,
                    to: _this.$parent.contractAddress,
                    value: 0,
                    nonce: nonce,
                    gasPrice: 1000000,
                    gasLimit: 2000000,
                    contract: {
                        function: "setProfile",
                        args: args
                    }
                }
                var tx = new Transaction(options);
                tx.signTransaction();
                nasApi.sendRawTransaction({
                    data: tx.toProtoString()
                }).then(function (hash) {
                    if (hash.txhash) {
                        _this.$message.success("设置个人信息成功!根据区块打包状态，可能会有延时。")
                        _this.$router.push({
                            path: "/",
                        })
                    }
                });
            })
        },
        submitForm: function (formName) {
            var _this = this

            this.$refs[formName].validate(function (valid) {
                if (valid) {
                    _this.setProfile()
                } else {
                    _this.$message.error("表单验证错误！")
                    return false;
                }
            });
        },
        getProfile: function () {
            var _this = this;
            if (!this.$parent.nebState) {
                // _this.$message.error("获取节点状态失败！")
                return
            }
            if (!this.$parent.account) {
                _this.$parent.unlockWallectVisible = true
                _this.$message.error("获取钱包信息失败，请加载并解锁你的钱包")
                return
            }

            var contractAddress = this.$parent.contractAddress
            // var nonce = this.$parent.getNonce()

            nasApi.call({
                chainID: this.$parent.nebState.chain_id,
                from: (this.$parent.account && this.$parent.account.getAddressString()) ||
                    contractAddress,
                to: contractAddress,
                value: 0,
                // nonce: nonce,
                gasPrice: 1000000,
                gasLimit: 2000000,
                contract: {
                    function: "getProfile",
                    args: JSON.stringify([])
                }
            }).then(function (resp) {
                // console.log(resp)
                _this.loading = false
                if (resp.error) {
                    return
                }
                if (resp.execute_err) {
                    return _this.$message.error(resp.execute_err)
                }
                var result = JSON.parse(resp.result)
                if(result){
                    _this.setting = result
                }    
            })
        }
    },
    created: function () {
        this.getProfile()
    },
    data: function () {
        return {
            loading: true,
            settingRules: {
                nickName: {
                    required: true,
                    message: '必须输入昵称',
                    trigger: 'blur'
                },
            },
            setting: {
                nickName: ""
            }
        }
    }
}

var AddComponent = {
    template: '#add-tpl',
    methods: {
        addGuess: function () {
            var _this = this;
            if (!this.$parent.nebState) {
                _this.$message.error("获取节点状态失败！")
                return
            }
            if (!this.$parent.account) {
                _this.$message.warning("获取钱包信息失败，请加载并解锁你的钱包")
                _this.$parent.unlockWallectVisible = true
                return
            }

            var args = JSON.stringify([_this.form])

            nasApi.getAccountState({
                address: this.$parent.account.getAddressString()
            }).then(function (resp) {

                var nonce = resp.nonce * 1 + 1


                var tx = new Transaction({
                    chainID: _this.$parent.nebState.chain_id,
                    from: _this.$parent.account,
                    to: _this.$parent.contractAddress,
                    value: Unit.toBasic(Utils.toBigNumber(_this.form.nas, "nas")),
                    nonce: nonce,
                    gasPrice: 1000000,
                    gasLimit: 2000000,
                    contract: {
                        function: "save",
                        args: args
                    }
                });
                tx.signTransaction();
                nasApi.sendRawTransaction({
                    data: tx.toProtoString()
                }).then(function (hash) {
                    if (hash.txhash) {
                        _this.$message.success("添加猜数游戏成功!")
                        _this.$router.push({
                            name: "guessDetail",
                            params: {
                                id: hash.txhash
                            }
                        })
                    }
                });
            })

        },
        submitForm: function (formName) {
            var _this = this,
                endDateTime = this.endDateTime,
                now = new Date();
            if (endDateTime < now) {
                _this.$message.error("结束时间不能小于当前时间！")
                return
            }
            _this.form.endTime = endDateTime.getTime() / 1000

            this.$refs[formName].validate(function (valid) {
                if (valid) {
                    _this.addGuess()
                } else {
                    _this.$message.error("表单验证错误！")
                    return false;
                }
            });
        },
    },
    watch: {
        "$parent.account": function (n, o) {
            this.account = n
        },
        "$parent.balance": function (n, o) {
            this.balance = n
        },
    },
    data: function () {
        return {
            needPasswd: false,
            endDateTime: null,
            account: this.$parent.account,
            balance: this.$parent.balance,
            rules: {
                title: {
                    required: true,
                    message: '必须输入标题',
                    trigger: 'blur'
                },
                number: [{
                    required: true,
                    type: "number",
                    min: 10,
                    message: '最小必须2位数字',
                    trigger: 'blur'
                }, ],
                nas: [{
                    required: true,
                    type: "number",
                    min: 0.001,
                    message: '最小必须为 0.001',
                    trigger: 'blur'
                }, ],
                maxTry: {
                    required: true,
                    type: "number",
                    min: 1,
                    message: '最小必须为1次',
                    trigger: 'blur'
                },
            },
            form: {
                title: '',
                number: '',
                nas: 1,
                maxTry: 1,
                showDigits: true,
                passwd: "",
                endTime: 0,
                tips: ""
            }
        }
    }
}

var AboutComponent = {
    template: '#about-tpl'
}

var HomeComponent = {
    template: '#home-tpl',
    props: ['currentPage'],
    created: function () {
        this.fetchGuessList()
    },
    filters: {
        withdrawText: function (item) {
            var text = "取回NAS"
            if (item.config && item.config.retrieve) {
                text = "已取回"
            }
            return text
        }
    },
    watch: {
        "currentPage": function (n, o) {
            this.guessList = []
            this.loading = true
            this.fetchGuessList()
        },
        "activeTab": function () {
            this.loading = true
            this.offset = -1
            this.total = -1
            this.guessList = []
            this.fetchGuessList()
        },
        "$parent.nebState": function (n, o) {
            if (n) {
                this.fetchGuessList()
            }
        },
        "$parent.account": function (n, o) {
            this.fetchGuessList()
        }
    },
    methods: {
        withdrawGuess: function (item) {
            var _this = this;
            var contractAddress = this.$parent.contractAddress

            if (!this.$parent.nebState) {
                return false
            }

            nasApi.getAccountState({
                address: this.$parent.account.getAddressString()
            }).then(function (resp) {
                var nonce = resp.nonce * 1 + 1
                var options = {
                    chainID: _this.$parent.nebState.chain_id,
                    from: _this.$parent.account,
                    to: contractAddress,
                    value: 0,
                    nonce: nonce,
                    gasPrice: 1000000,
                    gasLimit: 2000000,
                    contract: {
                        function: "withdrawGuess",
                        args: JSON.stringify([item.hash])
                    }
                }

                var tx = new Transaction(options);
                tx.signTransaction();
                nasApi.sendRawTransaction({
                    data: tx.toProtoString()
                }).then(function (resp) {

                    if (resp.error) {
                        return _this.$message.error(resp.error)
                    }
                    if (resp.execute_err) {
                        return _this.$message.error(resp.execute_err)
                    }
                    var result = resp.result
                    _this.$alert('hash:' + result.txhash, '交易结果', {
                        confirmButtonText: '确定'
                    });

                }).catch(function (e) {
                    _this.$message.error(getErrMsg(e.message));
                });
            })

            return false
        },
        handleTabClick: function (tab) {
            // console.log(this.activeTab)
            this.fetchGuessList()
        },
        loadmore: function () {
            this.loadmoreYes = true
            this.loadmoreText = "加载中"

            if (this.offset == -1) {
                this.offset = this.total
            }
            this.offset = this.offset - this.limit

            if (this.offset == -1) {
                this.offset = 0
            }
            this.fetchGuessList()
        },
        fetchGuessList: function () {
            // console.log("fetchGuessList", this.currentPage)
            var func = "forEach";

            if (this.currentPage == "my") {
                func = "getAddressGuess"

                if (this.activeTab == "myPlay") {
                    func = "getPlayedGuess"
                }
            }
            var _this = this;
            var contractAddress = this.$parent.contractAddress

            if (!this.$parent.nebState) {
                return
            }

            if (func == "getAddressGuess" || func == "getPlayedGuess") {
                //需要加载钱包信息
                if (!this.$parent.account) {
                    this.$parent.unlockWallectVisible = true
                    return
                }
            }
            // var nonce = this.$parent.getNonce()
            nasApi.call({
                chainID: this.$parent.nebState.chain_id,
                from: (this.$parent.account && this.$parent.account.getAddressString()) ||
                    contractAddress,
                to: contractAddress,
                value: 0,
                // nonce: nonce,
                gasPrice: 1000000,
                gasLimit: 2000000,
                contract: {
                    function: func,
                    args: JSON.stringify([this.limit, this.offset])
                }
            }).then(function (resp) {
                // var resp = JSON.parse(resp)
                // console.log(resp)
                _this.loading = false
                if (resp.error) {
                    return
                }
                if (resp.execute_err) {
                    return _this.$message.error(resp.execute_err)
                }
                var result = resp.result
                var data = JSON.parse(result)
                //console.log(data)
                _this.guessList = _this.guessList.concat(data.guess)
                _this.total = data.total

                _this.loadmoreYes = false
                if (!data.guess.length) {
                    _this.loadmoreText = "没有更多数据"
                } else {
                    _this.loadmoreText = "加载更多"
                }


            }).catch(function (e) {
                _this.$message.error(e.message);
            });
        }
    },
    data: function () {
        return {
            loading: true,
            guessList: [],
            activeTab: "myPost",
            total: -1,
            offset: -1,
            limit: 9,
            loadmoreYes: false,
            loadmoreText: "加载更多"
        }
    }
}

var routes = [{
        path: '/',
        component: HomeComponent,
        name: "home",
        props: {
            "currentPage": "home"
        }
    },
    {
        path: '/my',
        component: HomeComponent,
        name: "myGuess",
        props: {
            "currentPage": "my"
        }
    },
    {
        path: '/add',
        component: AddComponent
    },
    {
        path: '/setting',
        component: SettingComponent,
        name: "setting"
    },
    {
        path: '/hash/:id',
        component: GuessDetailComponent,
        name: "guessDetail"
    },
    {
        path: '/about',
        component: AboutComponent
    },
]

var router = new VueRouter({
    routes: routes
})

var Main = {
    router: router,
    created: function () {
        // this.fetchAccount()
        this.fetchNebState()
        this.getWallectInfo();
        this.messageListener();
    },
    methods: {
        getWallectInfo: function () {
            window.postMessage({
                "target": "contentscript",
                "data": {},
                "method": "getAccount",
            }, "*");
        },
        messageListener: function () {
            var _this = this
            window.addEventListener('message', function (e) {
                if (e.data && e.data.data) {
                    if (e.data.data.account) {
                        _this.address = e.data.data.account
                        mylog("address:", _this.address)
                        // _this.updateUserInfo()
                    }
                }
            })
        },
        getNonce: function () {
            if (!this.accountState) {
                this.fetchAccountState()
                this.unlockWallectVisible = true
                throw new Error("nonce获取错误，请加载钱包文件");
                return
            }
            this.accountState.nonce = this.accountState.nonce * 1 + 1
            return this.accountState.nonce
        },
        changChain: function (chain) {
            if (chain == "mainnet") {
                this.chainStr = "主网"
            } else if (chain == "testnet") {
                this.chainStr = "测试网"
            }
            this.chain = chain
            localStorage.setItem("chain", chain)
            location.reload()
        },
        fetchAccountState: function () {
            var _this = this;

            if (!this.account) {
                return
            }
            this.nasApi.getAccountState({
                address: this.account.getAddressString()
            }).then(function (resp) {
                if (resp.error) {
                    throw new Error(resp.error);
                }
                var amount = Unit.fromBasic(Utils.toBigNumber(resp.balance), "nas").toNumber()
                app.balance = amount

                _this.disabledUnlock = false
                _this.unlockText = "解锁"
                _this.loadingAccountState = false
                _this.accountState = resp
            });
        },
        fetchNebState: function () {
            var _this = this
            this.nasApi.getNebState().then(function (state) {
                _this.nebState = state
            })
        },
        handleSelect: function (item) {},
        handleClose: function (done) {
            done();
            this.unlockWallectVisible = false
        },
        onUnlockFile: function () {
            var _this = this
            try {
                this.account.fromKey(this.mFileJson, this.walletPasswd);
                this.unlockWallectVisible = false
            } catch (e) {

                _this.$message.error("keystore 文件错误, 或者密码错误")
            }

        },
        walletFile: function (file) {
            var _this = this
            this.needPwd = true

            var fr = new FileReader();
            fr.onload = onload;
            fr.readAsText(file.raw);

            function onload(e) {
                try {
                    mFileJson = JSON.parse(e.target.result);
                    mAccount = Account.fromAddress(mFileJson.address)
                    _this.mFileJson = mFileJson
                    _this.account = mAccount
                    _this.unlockText = "获取账号状态"
                    _this.loadingAccountState = true
                    _this.fetchAccountState()

                } catch (e) {
                    _this.$message.error(e.message)
                }
            }

        }
    },
    data: function () {
        return {
            mFileJson: null,
            mAccount: null,
            unlockWallectVisible: false,
            loadingAccountState: false,
            disabledUnlock: true,
            unlockText: "解 锁",
            needPwd: false,
            walletPasswd: "",
            visible: true,
            nasApi: nasApi,
            activeIndex: 1,
            balance: 0,
            account: null,
            nebState: null,
            accountState: null,
            contractAddress:chainInfo.contractAddress,
            chainnetConfig: chainnetConfig,
            chainStr: chainInfo.name,
            chainnet: chain,
            address :""

        }
    }
}

Vue.filter("dateFormat", function (value) {
    var date = new Date(value * 1000)
    return date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
})

Vue.filter("guessStatus", function (item) {
    item.status = "normal"
    item.statusText = "正在进行"

    

    if (item.success) {
        item.status = "success"
        item.statusText = "已完成"

        if (app.account && item.success.author == app.account.getAddressString()) {
            item.statusText = "已中奖"
        }
        return
    }

    var date = new Date(item.endTime * 1000),
        now = new Date();

    if (date < now) {
        item.expired = true
        item.status = "expired"
        item.statusText = "已结束"
        return
    }
    return
})
var Ctor = Vue.extend(Main)
var app = new Ctor()
app.$mount('#app')