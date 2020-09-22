import { createDfuseClient } from '@dfuse/client';
import { Api, JsonRpc, RpcError } from 'eosjs';
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig';
import ecc from 'eosjs-ecc';
import { copyObj } from './objects';

import settings from '../settings';

export default class Accountability {
    // SEE account FOR TYPES!!!
    // import {AccountExtended, SearchTransactionsResponseExtended} from '../types/accounts.ignore'

    rpc; // {JsonRpc} read from blockchain with eosjs
    api; // {Api} interact with blockchain with eosjs
    dfuseClient; // {DfuseClient} use enhanced blockchain api
    account; // { accountName, permission, pubKey}

    /** 
     * @param {Object} network
     * @param {string} network.nodeos - http origin nameo of nodeos with http api enabled
     * @param {DfuseOptions} network.dfuseOptions - dfuse API options
     */
    constructor(network = { nodeos: settings.eosio.nodeos, dfuseOptions: settings.dfuseOptions }) {
        this.rpc = fetch ? new JsonRpc(network.nodeos, { fetch }) : new JsonRpc(network.nodeos);
        if (settings.isLiveEnvironment()) settings.secure = true;
        const dfuseOptions = network.dfuseOptions;
        if (fetch) {
            dfuseOptions.httpClientOptions = {
                fetch: fetch
            }
        }
        // if (ws) {
        //     dfuseOptions.graphqlStreamClientOptions = {
        //         socketOptions: {
        //             webSocketFactory: (url) => ws(url, ["graphql-ws"])
        //         }
        //     }
        //     dfuseOptions.streamClientOptions = {
        //         socketOptions: {
        //             webSocketFactory: (url) => ws(url)
        //         }
        //     }
        // }
        this.dfuseClient = createDfuseClient(dfuseOptions);
    }

    /** 
     * Adds account and private key to object for sending transactions
     * @param {Object} account
     * @param {string} account.accountName - account name
     * @param {string} account.permission - account permission to use
     * @param {string} account.privKey - private key
     */
    login(account) {
        let accountCopy = copyObj(account);

        const signatureProvider = new JsSignatureProvider([accountCopy.privKey]);
        accountCopy.pubKey = ecc.privateToPublic(accountCopy.privKey);

        delete accountCopy.privKey;
        this.account = accountCopy;

        const rpc = this.rpc;
        this.api = TextEncoder ?
            new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() }) :
            new Api({ rpc, signatureProvider });
    }


    /**
    * Returns data from the current blockchain state
    */
    // use this.dfuseClient.stateTable()


    /**
     * Searches the transaction history
     * Extended response type also includes the human account name and common name that signed the tx
     * @returns {SearchTransactionsResponseExtended}
     */
    // use this.dfuseClient.searchTransactions()


    /**
     * Gets information about an account, with extended response type with common name
     * @response {AccountExtended}
     */
    // use this.rpc.get_account()


    /** 
     * Sends a transaction to the blockchain
     * @param {string} receiver - account on which to call contract execution
     * @param {string} action - action to execut
     * @param {obj} data - arguments for the action to execute with
     * @param {Object} [options] - configuration parameters (optional)
     * @param {string} [options.status] - throw error if tx status is not this
     * @returns {Object} transaction object
     */
    async transact(receiver, action, data, options) {
        let txData;
        try {
            txData = {
                actions: [{
                    account: receiver,
                    name: action,
                    authorization: [{
                        actor: this.account.accountName,
                        permission: this.account.permission,
                    }],
                    data: data,
                }]
            }

            const tx = await this.api.transact(txData, {
                blocksBehind: 3,
                expireSeconds: 30,
            })
            if (options) {
                if (tx.processed.error_code) throw Error("Failed with error code: " + tx.processed.error_code);
                if (options.status && tx.processed.receipt.status !== options.status) throw Error("Tx status is " + tx.processed.receipt.status);
            }
            return tx;
        } catch (e) {
            console.log('transact', txData)
            console.log('\nCaught exception: ' + e);
            if (e instanceof RpcError)
                console.error(JSON.stringify(e.json, null, 2));
            else {
                console.error(e)
                throw Error(e);
            }
        }
    }

}