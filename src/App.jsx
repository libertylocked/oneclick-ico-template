import React, { Component } from "react"
import Bluebird from "bluebird"
import bn from "bignumber.js"
import getWeb3 from "./utils/getWeb3"
// contracts and stuff
import BasicTokensaleArtifact from "../build/contracts/BasicTokensale.json"
import ICOableTokenArtifact from "../build/contracts/ICOableToken.json"
import { TokenAddr, SaleAddr } from "../ico-config.json"

const TruffleContract = require("truffle-contract")

import './css/oswald.css'
import './css/open-sans.css'
import './css/pure-min.css'
import './App.css'

class App extends Component {
  constructor(props) {
    super(props)

    this.state = {
      web3: null,
      account: null,
      networkID: null,
      saleInstance: null,
      tokenInstance: null,
      tokenInfo: {
        name: null,
        decimals: null,
        symbol: null,
        tradableAfter: null,
        totalSupply: null,
      },
      saleInfo: {
        saleStartTime: null,
        saleEndTime: null,
        salePrice: null,
        tokensLeft: null,
      },
      investEth: "",
    }
  }

  componentWillMount = async () => {
    let web3, networkID, account
    try {
      web3 = await getWeb3()
      Bluebird.promisifyAll(web3.eth, { suffix: "Promise" })
      Bluebird.promisifyAll(web3.version, { suffix: "Promise" })
      networkID = await web3.version.getNetworkPromise()
      account = (await web3.eth.getAccountsPromise())[0]
    } catch (err) {
      console.error(err)
      alert("cannot load web3! do you have metamask running?")
      return
    }

    this.setState({
      web3,
      networkID,
      account
    })

    await this.instantiateContract()
  }

  instantiateContract = async () => {
    const Tokensale = TruffleContract(BasicTokensaleArtifact)
    Tokensale.setProvider(this.state.web3.currentProvider)
    const saleInstance = Tokensale.at(SaleAddr)
    const Token = TruffleContract(ICOableTokenArtifact)
    Token.setProvider(this.state.web3.currentProvider)
    const tokenInstance = Token.at(TokenAddr)
    // get info about token
    const name = await tokenInstance.name()
    const decimals = await tokenInstance.decimals()
    const symbol = await tokenInstance.symbol()
    const tradableAfter = new Date((await tokenInstance.tradableAfter()) * 1000)
    const totalSupply = await tokenInstance.totalSupply()
    const tokenSeller = await tokenInstance.tokenSeller()
    // get info about tokensale
    const saleStartTime = new Date((await saleInstance.saleStartTime()) * 1000)
    const saleEndTime = new Date((await saleInstance.saleEndTime()) * 1000)
    const salePrice = await saleInstance.salePrice()
    const tokensLeft = await tokenInstance
      .allowance(tokenSeller, saleInstance.address)
    this.setState({
      tokenInstance,
      saleInstance,
      tokenInfo: {
        name,
        decimals,
        symbol,
        tradableAfter,
        totalSupply,
      },
      saleInfo: {
        saleStartTime,
        saleEndTime,
        salePrice,
        tokensLeft,
      }
    })
  }

  handleBuyClick = async () => {
    const tx = await this.state.saleInstance.sendTransaction({
      from: this.state.account,
      value: this.state.web3.toWei(1),
    })
    console.log(tx)
    if (tx.logs[0].event === "TokensSold") {
      // success
      alert("success! you bought the tokens!")
      console.log(tx.logs[0].args)
    }
  }

  render() {
    return (
      <div className="App">
        <nav className="navbar pure-menu pure-menu-horizontal">
          <a href="#" className="pure-menu-heading pure-menu-link">Buy my ICO</a>
        </nav>

        <main className="container">
          <div className="pure-g">
            <div className="pure-u-1-1">
              <h1>Disclaimers</h1>
              <p>Guaranteed 10x return!</p>
              <p>don't participate in the ico if ur a US individual</p>
              <p>insert some generic disclaimers here</p>
              {this.state.saleInstance ? (
                <div>
                  <h2>Version Info</h2>
                  <p>You are on <strong>{this.state.networkID === 1 ? "mainnet" : "testnet"}</strong>
                    {" "}({this.state.networkID}).</p>
                  <p>Token address: <strong>{this.state.tokenInstance.address}</strong></p>
                  <p>Sale address: <strong>{this.state.saleInstance.address}</strong></p>
                  <p>Your address: <strong>{this.state.account}</strong></p>
                </div>
              ) : <p>web3 is loading!</p>}
            </div>
            <hr />
            {this.state.saleInstance ? (
              <div className="pure-u-1-1">
                <h1>{this.state.tokenInfo.name} ({this.state.tokenInfo.symbol}) Tokensale</h1>
                <p>Total Supply: {this.state.tokenInfo.totalSupply
                  .dividedBy(Math.pow(10, this.state.tokenInfo.decimals))
                  .toString()}
                </p>
                <p>Tokens Left: {this.state.saleInfo.tokensLeft
                  .dividedBy(Math.pow(10, this.state.tokenInfo.decimals))
                  .toString()}
                </p>
                <p>Start Time: {this.state.saleInfo.saleStartTime.toLocaleString()}</p>
                <p>End Time: {this.state.saleInfo.saleEndTime.toLocaleString()}</p>
                <p>Sale Price: {new bn(1)
                  .dividedBy(this.state.web3.fromWei(this.state.saleInfo.salePrice))
                  .dividedBy(Math.pow(10, this.state.tokenInfo.decimals)).toString()} BST / ETH</p>
                <h2>buy the shit now and get rich</h2>
                <div>
                  <label>
                    I'm investing
                    <input onChange={(e) => {
                      this.setState({ investEth: e.target.value })
                    }} /> ETH
                  </label>
                  <p>
                    {isNaN(this.state.investEth) || !this.state.investEth ? "Enter a number!"
                      :
                      `This will get you ${new bn(this.state.web3.toWei(this.state.investEth))
                        .dividedBy(this.state.saleInfo.salePrice)
                        .dividedBy(Math.pow(10, this.state.tokenInfo.decimals))} BST`}
                  </p>
                  <button onClick={this.handleBuyClick}>buy the ico</button>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    );
  }
}

export default App
