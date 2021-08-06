String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};
function blurAll(){
    var tmp = document.createElement("input");
    document.body.appendChild(tmp);
    tmp.focus();
    document.body.removeChild(tmp);
};
function removeDuplicatesBy(keyFn, array) {
    var mySet = new Set();
    return array.filter(function(x) {
        var key = keyFn(x), isNew = !mySet.has(key);
        if (isNew) mySet.add(key);
        return isNew;
    });
}
function sortTransactionsOfBundleByAttachments(transactions) {
    var bundleWithSortedAttachments = [];
    var tailTransactions = transactions.filter((transaction)=>{return transaction.currentIndex==0});
    tailTransactions.forEach((tailTransaction)=>{
        var attachment = [];
        attachment.push(tailTransaction);
        var trunkToFind = tailTransaction.trunkTransaction;
        for(var i=1;i<=tailTransaction.lastIndex;i++) {//needed just for iterate
            for(var o=0;o<transactions.length;o++) {//needed to find in all transactions
                if(trunkToFind===transactions[o].hash) {
                    attachment.push(transactions[o]);
                    trunkToFind = transactions[o].trunkTransaction;
                }
            };
        }
        bundleWithSortedAttachments.push(attachment);
    });
    return bundleWithSortedAttachments;
}
function convertTimestamp(timestamp) {
    var d = 
        new Date(timestamp * 1000),	// Convert the passed timestamp to milliseconds
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),	// Months are zero based. Add leading 0.
        dd = ('0' + d.getDate()).slice(-2),			// Add leading 0.
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),		// Add leading 0.
        ampm = 'AM',
        time;
                
    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh == 0) {
        h = 12;
    }
        
    // ie: 2013-02-18, 8:35 AM	
    time = yyyy + ' ' + mm + ' ' + dd + ', ' + h + ':' + min + ' ' + ampm;
    return time;
}
function initialState(reset) {
    if(typeof reset == 'undefined')
        return {
            searchInput: null,
            searchedInput: null,
            msg: null,
            inputTimeout: null,
            searching: false,
            iota: new window.IOTA({"provider":"https://www.exploiota.com/node"}),
            showCancel: false,
            showRetry: false,
            balance: null,
            bundleStates: {},
            transactionStates: {},
            confirmedAttachmentsByBundle: {},
            addressResults: [],
            validAttachmentsByBundle: {},
            timeout: null,
            reattaching: false,
            bundle: null,
            bundle_confirmed: null,
            currentRoute: null,
            miotaPrice: 0,
            fiatView: false
        };
    else
        return {
            searchedInput: null,
            msg: null,
            inputTimeout: null,
            searching: false,
            iota: new window.IOTA({"provider":"https://www.exploiota.com/node"}),
            showCancel: false,
            showRetry: false,
            balance: null,
            bundleStates: {},
            transactionStates: {},
            confirmedAttachmentsByBundle: {},
            addressResults: [],
            validAttachmentsByBundle: {},
            timeout: null,
            reattaching: false,
            bundle: null,
            bundle_confirmed: null,
            currentRoute: null
        };
}
main = new Vue({
    el: "#app",
    data: initialState(),
    watch: {
        searchInput: function(val,Oldval) {
            try{
                this.searchInput = val.toUpperCase().replaceAll(/[^[A-Z]]*/,"9");
                this.searchInput = this.searchInput.slice(0,90);
            }catch(e) {}
        }
    },
    methods: {
        search: function() {
            this.reset();
            this.searchedInput = this.searchInput;
            this.showRetry = false;
            this.msg = null;
            blurAll();
            this.searching = true;
            clearTimeout(this.timeout);
            this.timeout = setTimeout(()=>{ if(this.searching === true) this.showCancel = true; }, 15000);
            if(this.searchedInput.length === 90) {//address
                this.findAddress();
            }else{
                if(this.searchedInput.length === 81) {//transaction, address or bundle or nothing

                    var promises = [];
                    promises.push(new Promise((resolve,reject)=>{
                        this.iota.api.findTransactionObjects({"addresses":[this.searchedInput]},(err,results)=>{
                            if(err) return reject(err);
                            console.log(results);
                            resolve(results);
                        });
                    }));
                    promises.push(new Promise((resolve,reject)=>{
                        this.iota.api.findTransactionObjects({"bundles":[this.searchedInput]},(err,results)=>{
                            if(err) return reject(err);
                            resolve(results);
                        });
                    }));
                    if(this.searchedInput.slice(-3) === "999")
                        promises.push(new Promise((resolve,reject)=>{
                            this.iota.api.getTransactionsObjects([this.searchedInput],(err,results)=>{
                                if(err) return reject(err);
                                resolve(results);
                            });
                        }));
                    Promise.all(promises)
                        .then((results)=>{
                            this.searching = false;
                            var founds = {
                                address: results[0].length > 0,
                                bundle: results[1].length > 0,
                                transaction: typeof results[2] !== 'undefined' && results[2].length > 0
                            }
                            if(Object.values(founds).filter((result)=>{return result}).length === 1) {//verify is just one result
                                if(founds.address) {
                                    this.searchedInput = this.iota.utils.addChecksum(this.searchedInput);
                                    this.findAddress(results[0]);
                                }else if(founds.bundle) {
                                    this.processBundle(results[1]);
                                }else if(founds.transaction) {
                                    this.searchedInput = results[2][0].bundle;
                                    this.searching = true;
                                    clearTimeout(this.timeout);
                                    this.timeout = setTimeout(()=>{ if(this.searching === true) this.showCancel = true; }, 15000);
                                    this.iota.api.findTransactionObjects({"bundles":[this.searchedInput]},(err,results)=>{
                                        this.searching = false;
                                        clearTimeout(this.timeout);
                                        if(err) {
                                            console.log(err);
                                            this.msg = "Ups, some error detected! Please try again";
                                            this.showRetry = true;
                                            return;
                                        }
                                        this.searchInput = results[0].bundle;
                                        this.processBundle(results);
                                    });
                                }
                            }else if(Object.values(founds).filter((result)=>{return result}).length == 0){
                                this.msg = "<b>The hash isn\'t related with any transaction created since the last snapshot ("+convertTimestamp(1531123200)+")</b>";
                                this.msg += "<a style=\"margin-left:5px;\" class=\"btn yellow black-text\" href=\"/address/"+this.iota.utils.addChecksum(this.searchInput)+"\">Search as address</a>";
                                this.showRetry = true;
                            }else{
                                this.msg = "What are you looking for? A transaction, an address";
                            }
                        })
                        .catch((err)=>{
                            console.log(err);
                            this.searching = false;
                            if(err) {
                                this.msg = "Ups, some error detected! Please try again";
                                this.showRetry = true;
                                return;
                            }
                        });
                }else{//tag or nothing
                    this.iota.api.findTransactionObjects({"tags":[this.searchedInput]},(err,array)=>{
                        this.searching = false;
                        if(err) {
                            this.msg = "Ups, some error detected! Please try again";
                            this.showRetry = true;
                            return;
                        }
                    });
                }
            }
        },
        cancelQuery: function() {
            window.stop();
            this.showCancel = false;
            this.searching = false;
            this.msg = 'Query canceled';
            this.showRetry = true;
        },
        getOutputs: function(bundle) {
            return bundle.filter((transaction)=>{return transaction.value<0});
        },
        getInputs: function(bundle) {
            return bundle.filter((transaction)=>{return transaction.value>=0});
        },
        getRelevantValueTransfered: function(bundle) {
            var total = 0;
            if(this.balance && this.addressResults.length)
                bundle.forEach((transaction)=>{
                    if(this.searchedInput.includes(transaction.address))
                        total += transaction.value;
                });
            if(this.bundle)
                bundle.forEach((transaction)=>{
                    if(transaction.value > 0)
                        total += transaction.value;
                });
            return total;
        },
        stylizeRelevantValueTransfered: function(relevantValueTransfered,color) {
            var total = relevantValueTransfered;
            if(this.fiatView) {
                var miotas = this.iota.utils.convertUnits(total,"i","Mi");
                var fiat = miotas*this.miotaPrice;
                var totalWithUnit = [parseInt(fiat).toString().replace(/\d(?=(?:\d{3})+$)/g, '$&.')+" USD"];
            }else{
                if(Math.abs(total) >= 0 && Math.abs(total) < 1000000000) {
                    var totalWithUnit = this.iota.utils.convertUnits(total,"i","Mi") + " Mi";
                }else if(Math.abs(total) >= 1000000 && Math.abs(total) < 1000000000000) {
                    var totalWithUnit = this.iota.utils.convertUnits(total,"i","Gi") + " Gi";
                }else if(Math.abs(total) >= 1000000000 && Math.abs(total)<1000000000000000) {
                    var totalWithUnit = this.iota.utils.convertUnits(total,"i","Ti") + " Ti";
                }else if(Math.abs(total)>=1000000000000000) {
                    var totalWithUnit = this.iota.utils.convertUnits(total,"i","Pi") + " Pi";
                }
                totalWithUnit = totalWithUnit.split(".");
                if(totalWithUnit.length > 1)//if 1 Mi , 1 Gi, 1 Ti or 1 Pi, it had not "."
                    if(Math.abs(total) >= 10000)
                        totalWithUnit[1] = totalWithUnit[1].slice(0,2) + '<span class="addressMiddle">' + totalWithUnit[1].slice(2,-3) + '</span>' + totalWithUnit[1].slice(-3);
            }
            if(typeof color === 'undefined') {
                return '<a class="waves-effect  btn '+(total > 0 ? 'green' : 'red darken-1')+' white-text" style="text-transform:none;">'+totalWithUnit.join(".")+'</a>';
            } else {
                if(color == 'blue')
                    return '<a class="waves-effect  btn blue white-text" style="text-transform:none;">'+totalWithUnit.join(".")+'</a>';
                else
                    return '<strong class="'+color+'-text">' + totalWithUnit.join("."); + '</strong>';
            }
        },
        stylizeAddress: function(address) {
            var newAddr = address.match(/.{1,3}/g);
            newAddr[0] = '<b class="addressStart">' + newAddr[0];
            newAddr[3] = newAddr[3] + '</b><span class="addressSemiMiddle">';
            newAddr[6] = newAddr[6] + '</span><span class="addressMiddle">';
            newAddr[24] = '</span><span class="addressSemiMiddle">' + newAddr[24];
            newAddr[26] = '</span><b class="addressEnd">' + newAddr[26] + '</b>';
            return  '<span class="address">' + newAddr.join("") + '<b class="addressChecksum">' +this.iota.utils.addChecksum(address).slice(-9)+'</span></span>';
        },
        stylizeHash: function(hash) {
            var newHash = hash.match(/.{1,3}/g);
            newHash[0] = '<b class="addressStart">' + newHash[0];
            newHash[2] = newHash[2] + '</b><span class="addressSemiMiddle">';
            newHash[6] = newHash[6] + '</span><span class="addressMiddle">';
            newHash[23] = '</span><span class="addressSemiMiddle">' + newHash[23];
            newHash[24] = '</span><b class="addressEnd">' + newHash[24];
            newHash[26] += '</b>';
            return  newHash.join("");
        },
        isInput: function(bundle) {
            var total = 0;
            bundle.forEach((transaction)=>{
                if(transaction.address === this.iota.utils.noChecksum(this.searchedInput))
                    total += transaction.value;
            });
            if(total > 0) return true;
            if(total < 0) return false;
            if(total == 0) return true;
        },
        convertTimestamp: function(timestamp) {
            return convertTimestamp(timestamp);
        },
        reattach: function(bundle,event) {
            M.toast({html: 'Reattaching, please wait...'});
            $(".reattach").attr('disabled', true);
            this.reattaching = bundle[0][0].bundle;
            // Get the trytes of all the bundle objects
            var bundleTrytes = [];

            bundle[0].forEach((bundleTx) => {
                bundleTrytes.push(this.iota.utils.transactionTrytes(bundleTx));
            });

            this.iota.api.sendTrytes(bundleTrytes.reverse(), 3, 14, (e,result)=>{
                setTimeout(()=>{
                    $(".reattach").attr('disabled', false);
                });
                if(e) {
                    M.toast({html: 'Error reattaching'});
                    console.log(e);
                    return;
                }
                M.toast({html: 'Reattached'});
                bundle.push(result);
                this.validAttachmentsByBundle[result[0].bundle]++;
                this.reattaching = null;
            });
        },
        removePulse: function() {
            $(".pulse").removeClass('pulse');
        },
        countInvalidAttachments: function(bundle) {
            var count = 0;
            bundle.forEach((attachment)=>{
                this.iota.utils.isBundle(attachment) && count++;
            });
            return count;
        },
        findAddress: function(transactions) {
            document.title = "Address "+this.searchedInput+" - Exploiota.com";

            window.history.pushState(null,document.title, "/address/"+this.searchedInput);
            this.iota.api.getBalances([this.searchedInput],100,(err,result)=> {
                this.searching = false;
                clearTimeout(this.timeout);
                if(err) {
                    this.msg = 'Querying address balance';
                    console.log(err);
                    this.showRetry = true;
                    return;
                }
                this.balance = result.balances[0];

                this.timeout = setTimeout(()=>{ if(this.searching === true) this.showCancel = true; }, 15000);
                this.searching = true;
                var processTransactionsOfAddress = (err,transactions) => {
                    this.searching = false;
                    clearTimeout(this.timeout);
                    if(err) {
                        this.msg = 'Error tracking address';
                        console.log(err);
                        this.showRetry = true;
                        return;
                    }
                    if(transactions.length == 0) {
                        this.msg = "0 transactions since the last snapshot ("+convertTimestamp(1531123200)+")";
                        return;
                    }
                    var transactionsWithUniqueBundle = removeDuplicatesBy(x => x.bundle, transactions);
                    var bundlesHashes = transactionsWithUniqueBundle.map((transaction)=>{ return transaction.bundle; });

                    
                    this.timeout = setTimeout(()=>{ if(this.searching === true) this.showCancel = true; }, 15000);
                    this.searching = true;
                    this.iota.api.findTransactionObjects({"bundles":bundlesHashes},(err,transactions)=>{
                        this.searching = false;
                        clearTimeout(this.timeout);
                        if(err) {
                            console.log(err);
                            this.msg = "Error tracking bundles";
                            this.showRetry = true;
                            return;
                        }
                        var transactionsByBundleHash = [];
                        bundlesHashes.forEach((bundleHash)=>{
                            transactionsByBundleHash.push(transactions.filter((transaction)=>{ return transaction.bundle == bundleHash; }));
                        });
    
                        var sortedByAttachment = [];
                        transactionsByBundleHash.forEach((unsortedTransactionsOfBundle)=>{
                            sortedByAttachment.push(sortTransactionsOfBundleByAttachments(unsortedTransactionsOfBundle));
                        });
                        
                        sortedByAttachment = this.sortBundlesByDateTime(sortedByAttachment);
    
                        var tailsAndTheirBundle = {};
                        sortedByAttachment.forEach((bundle)=>{
                            var tails = bundle.map((attachment)=>{return attachment[0].hash;});
                            tails.forEach((tailHash)=>{
                                tailsAndTheirBundle[tailHash] = bundle[0][0].bundle;
                            });
                        });
    
                        if(Object.keys(tailsAndTheirBundle).length > 0) {
                            this.timeout = setTimeout(()=>{ if(this.searching === true) this.showCancel = true; }, 15000);
                            this.searching = true;
                            this.iota.api.getLatestInclusion(Object.keys(tailsAndTheirBundle), (e,states)=>{
                                this.searching = false;
                                clearTimeout(this.timeout);
                                if(e) {
                                    console.log(e);
                                    this.msg = "Error getting latest inclusion states";
                                    this.showRetry = true;
                                    return;
                                }
                                states.forEach((state,index)=>{
                                    if(typeof this.bundleStates[Object.values(tailsAndTheirBundle)[index]] === 'undefined')
                                        this.bundleStates[Object.values(tailsAndTheirBundle)[index]] = false;
                                    if(!this.bundleStates[Object.values(tailsAndTheirBundle)[index]])
                                        this.bundleStates[Object.values(tailsAndTheirBundle)[index]] = state;//bundles
                                    this.transactionStates[Object.keys(tailsAndTheirBundle)[index]] = state;
                                });
                                sortedByAttachment.forEach((bundle)=>{
                                    bundle.forEach((attachment)=>{
                                        if(typeof this.confirmedAttachmentsByBundle[attachment[0].bundle] === 'undefined')
                                            this.confirmedAttachmentsByBundle[attachment[0].bundle] = 0;
                                        if(this.transactionStates[attachment[0].hash])
                                            this.confirmedAttachmentsByBundle[attachment[0].bundle]++;
                                    });
                                });
    
                                sortedByAttachment.forEach((bundle,index)=>{
                                    var validAttachments = [];
                                    var invalidAttachments = [];
                                    bundle.forEach((attachment,index)=>{
                                        if(this.iota.utils.isBundle(attachment)) {
                                            validAttachments.push(attachment);
                                        }else{
                                            invalidAttachments.push(attachment);
                                        }
                                    });
                                    this.validAttachmentsByBundle[bundle[0][0].bundle] = validAttachments.length;
                                    sortedByAttachment[index] = validAttachments.concat(invalidAttachments);
                                });
                                var promises = [];
                                this.timeout = setTimeout(()=>{ if(this.searching === true) this.showCancel = true; }, 15000);
                                this.searching = true;
                                sortedByAttachment.forEach((bundle)=>{
                                    promises.push(new Promise((resolve,reject)=>{
                                        if(this.validAttachmentsByBundle[bundle[0][0].bundle] > 0) {
                                            var addressesToCheck = {};
                                            var negatives = bundle[0].filter((transaction)=>{ return transaction.value < 0; });
                                            negatives.forEach((transaction)=>{
                                                addressesToCheck[transaction.address] = transaction.value*-1;
                                            });
                                            this.iota.api.getBalances(Object.keys(addressesToCheck),100,(e,r)=>{
                                                if(e) return reject(e);
                                                resolve({addressesToCheck,balances:r.balances,bundle});
                                            });
                                        }
                                    }));
                                });
                                Promise.all(promises)
                                    .then((results)=>{
                                        this.searching = false;
                                        clearTimeout(this.timeout);
                                        results.forEach((result)=>{
                                            var consistent = true;
                                            result.balances.forEach((balance,index)=>{
                                                if(balance<Object.values(result.addressesToCheck)[index]) {
                                                    consistent = false;
                                                }
                                            });
                                            if(!consistent) 
                                                this.validAttachmentsByBundle[result.bundle[0][0].bundle] = -1;
                                            this.addressResults.push(result.bundle);
                                        });
                                    })
                                    .catch((err)=>{
                                        console.log(err);
                                        this.searching = false;
                                        if(err) {
                                            this.msg = "Ups, some error detected! Please try again";
                                            this.showRetry = true;
                                            return;
                                        }
                                    });
                            });
                        }
                    });
                };
                if(typeof transactions == 'undefined')
                    this.iota.api.findTransactionObjects({"addresses":[this.searchedInput]},processTransactionsOfAddress);
                else
                    processTransactionsOfAddress(null,transactions);

            });
        },
        sortBundlesByDateTime: function(bundles) {
            var timestamps = {};
            bundles.forEach((bundle,index)=>{
                timestamps[bundle[0][0].attachmentTimestamp] = index;
            });
            var orderedTimestamps = Object.keys(timestamps).sort(function(a, b){return b-a});

            var orderedBundles = [];
            orderedTimestamps.forEach((timestamp)=>{
                orderedBundles.push(bundles[timestamps[timestamp]]);
            });
            return orderedBundles;
        },
        stopReattach: function() {
            window.stop();
            setTimeout(()=>{
                $(".reattach").attr('disabled', false);
            });
            this.reattaching=null;
            M.toast({html: 'Reattach cancelled'});
        },
        processBundle: function(transactions) {
            document.title = "Bundle "+this.searchedInput+" - Exploiota.com";
            window.history.pushState(null,document.title, "/bundle/"+this.searchedInput);
            var sortedByAttachment = sortTransactionsOfBundleByAttachments(transactions);
            var tails = sortedByAttachment.map((attachment)=>{return attachment[0].hash;});

            this.timeout = setTimeout(()=>{ if(this.searching === true) this.showCancel = true; }, 15000);
            this.searching = true;
            this.iota.api.getLatestInclusion(tails, (e,states)=>{
                this.searching = false;
                clearTimeout(this.timeout);
                if(e) {
                    console.log(e);
                    this.msg = "Error getting latest inclusion states";
                    this.showRetry = true;
                    return;
                }
                states.forEach((state,index)=>{
                    this.transactionStates[tails[index]] = state;
                });
                
                this.bundleStates[sortedByAttachment[0][0].bundle] = states.includes(true);

                [sortedByAttachment].forEach((bundle,index)=>{
                    var validAttachments = [];
                    var invalidAttachments = [];
                    bundle.forEach((attachment,index)=>{
                        if(this.iota.utils.isBundle(attachment)) {
                            validAttachments.push(attachment);
                        }else{
                            invalidAttachments.push(attachment);
                        }
                    });
                    this.validAttachmentsByBundle[bundle[0][0].bundle] = validAttachments.length;
                    sortedByAttachment = validAttachments.concat(invalidAttachments);
                });
                [sortedByAttachment].forEach((bundle)=>{
                    bundle.forEach((attachment)=>{
                        if(typeof this.confirmedAttachmentsByBundle[attachment[0].bundle] === 'undefined')
                            this.confirmedAttachmentsByBundle[attachment[0].bundle] = 0;
                        if(this.transactionStates[attachment[0].hash])
                            this.confirmedAttachmentsByBundle[attachment[0].bundle]++;
                    });
                });


                var promises = [];
                this.timeout = setTimeout(()=>{ if(this.searching === true) this.showCancel = true; }, 15000);
                this.searching = true;
                [sortedByAttachment].forEach((bundle)=>{
                    promises.push(new Promise((resolve,reject)=>{
                        if(this.validAttachmentsByBundle[bundle[0][0].bundle] > 0) {
                            var addressesToCheck = {};
                            var negatives = bundle[0].filter((transaction)=>{ return transaction.value < 0; });
                            negatives.forEach((transaction)=>{
                                addressesToCheck[transaction.address] = transaction.value*-1;
                            });
                            this.iota.api.getBalances(Object.keys(addressesToCheck),100,(e,r)=>{
                                if(e) return reject(e);
                                resolve({addressesToCheck,balances:r.balances,bundle});
                            });
                        }
                    }));
                });
                Promise.all(promises)
                    .then((results)=>{
                        this.searching = false;
                        clearTimeout(this.timeout);
                        results.forEach((result)=>{
                            var consistent = true;
                            result.balances.forEach((balance,index)=>{
                                if(balance<Object.values(result.addressesToCheck)[index]) {
                                    consistent = false;
                                }
                            });
                            if(!consistent) 
                                this.validAttachmentsByBundle[result.bundle[0][0].bundle] = -1;
                            this.bundle = this.sortBundlesByDateTime([sortedByAttachment])[0];
                        });
                    })
                    .catch((err)=>{
                        console.log(err);
                        this.searching = false;
                        if(err) {
                            this.msg = "Ups, some error detected! Please try again";
                            this.showRetry = true;
                            return;
                        }
                    });
            });
        },
        reset: function () {
            Object.assign(this.$data, initialState(true));
        },
        go: function(where,event) {
            if(typeof event != 'undefined')
                event.preventDefault();
            this.reset();
            var splitted = where.slice(1).split("/");
            switch(splitted[0]) {
                case "":
                    this.searchInput = "";
                    this.reset();
                    window.history.pushState(null,document.title, "/");
                break;
                case "address":
                    this.searchInput = splitted[1];
                    this.search();
                break;
                case "bundle":
                    this.searchInput = splitted[1];
                    this.search();
                break;
                case "transaction":
                    this.searchInput = splitted[1];
                    this.search();
                break;
                default:
                    alert("404");
                break;
            }
        },
        toast: function(html) {
            M.toast({html})
        },
        toFiat: function(q) {
            return "hola";
        },
        viewQr: function(content) {
            var qrcode = new QRCode("qrcode", {
                text: '{"address":"'+content+'"}',
                width: 200,
                height: 200,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
            var elems = document.querySelectorAll('#qrModal');
            var instances = M.Modal.init(elems, {
                onCloseEnd: function() {
                    $("#qrcode").html("");
                }
            });
            instances[0].open();
        }
    },
    mounted() {
        this.go(window.location.pathname);
        window.onpopstate = (event) => {
            this.go(window.location.pathname);
        };
        var elems = document.querySelectorAll('.tooltipped');
        var instances = M.Tooltip.init(elems);
    },
    updated: function() {
        M.AutoInit();
        $.get( "https://api.coinmarketcap.com/v2/ticker/1720/", ( response ) => {
            this.miotaPrice = response.data.quotes.USD.price;
        });
        new ClipboardJS('.btn');
    }
});