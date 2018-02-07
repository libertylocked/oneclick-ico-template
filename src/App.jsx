import React, { Component } from "react"
import 'semantic-ui-css/semantic.min.css'
import {
  Button, Card,
  Grid,
  Header,
  Modal, Progress,
  Segment,
} from 'semantic-ui-react'
import Countdown from "react-countdown-now"
import Bluebird from "bluebird"
import bn from "bignumber.js"
import getWeb3 from "./utils/getWeb3"
// contracts and stuff
import BasicTokensaleArtifact from "../build/contracts/BasicTokensale.json"
import ICOableTokenArtifact from "../build/contracts/ICOableToken.json"
import { TokenAddr, SaleAddr } from "../ico-config.json"

const TruffleContract = require("truffle-contract")

import './App.css'

// Renderer callback with condition
const CountdownRenderer = ({ days, hours, minutes, seconds, completed }) => {
  if (completed) {
    // Render a complete state
    return <span>Sale has ended</span>;
  } else {
    // Render a countdown
    return <span>
      {days} days
      {` `}
      {hours.toLocaleString(undefined, { minimumIntegerDigits: 2 })}:
      {minutes.toLocaleString(undefined, { minimumIntegerDigits: 2 })}:
      {seconds.toLocaleString(undefined, { minimumIntegerDigits: 2 })}
    </span>;
  }
}

/* Heads up!
 * Neither Semantic UI, nor Semantic UI React don't offer a responsive navbar, hover it can be easily implemented.
 * It can be more complicated, but you can create really flexible markup.
 */
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
        tokenSeller: null,
      },
      saleInfo: {
        saleStartTime: null,
        saleEndTime: null,
        salePrice: null,
        tokensLeft: null,
        balance: null,
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
    const balance = await this.state.web3.eth.getBalancePromise(saleInstance.address)
    this.setState({
      tokenInstance,
      saleInstance,
      tokenInfo: {
        name,
        decimals,
        symbol,
        tradableAfter,
        totalSupply,
        tokenSeller,
      },
      saleInfo: {
        saleStartTime,
        saleEndTime,
        salePrice,
        tokensLeft,
        balance,
      }
    })
  }

  handleBuyClick = async () => {
    const tx = await this.state.saleInstance.sendTransaction({
      from: this.state.account,
      value: this.state.web3.toWei(this.state.investEth),
    })
    console.log(tx)
    if (tx.logs[0].event === "TokenSold") {
      // success
      alert("success! you bought the tokens!")
      console.log(tx.logs[0].args)
    } else {
      alert("failed!")
    }
  }

  handleCashoutClick = async () => {
    const tx = await this.state.saleInstance.withdraw({
      from: this.state.account,
    })
    console.log(tx)
  }

  render() {
    return (
      <div>
        <Segment style={{ padding: '8em 0em' }} vertical>
          <Grid container stackable verticalAlign='middle'>
            <Grid.Row>
              <Grid.Column width={8}>
                <Header as='h3' style={{ fontSize: '2em' }}>Platform Title</Header>
                <p style={{ fontSize: '1.33em' }}>
                  What we are building
                </p>
                <Header as='h3' style={{ fontSize: '2em' }}>Token Title</Header>
                <p style={{ fontSize: '1.33em' }}>
                  Why you should buy our tokens
                </p>
              </Grid.Column>
              <Grid.Column floated='right' width={6}>
                Image placeholder
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </Segment>
        <Segment style={{ padding: '8em 0em' }} vertical>
          <Grid container>
            <Card color='blue' style={{ margin: 'auto' }}>
              <Card.Content extra>
                <Header as='p' textAlign='center'>
                  Time until tokensale ends
                </Header>
              </Card.Content>
              <Card.Content>
                <Header as='h1' inverted color='blue' textAlign='center'>
                  {this.state.saleInfo.saleEndTime ?
                    <Countdown
                      date={this.state.saleInfo.saleEndTime}
                      renderer={CountdownRenderer}
                    /> : <span>...</span>}
                </Header>
              </Card.Content>
            </Card>
            <Progress percent={this.state.saleInstance ?
              (1 - this.state.saleInfo.tokensLeft
                .div(this.state.tokenInfo.totalSupply).toNumber()) * 100
              : 0}
              active
              style={{ width: '100%', marginTop: 50 }} color='blue' progress>
              <p>
                {this.state.saleInstance ? `${
                  this.state.tokenInfo.totalSupply.minus(this.state.saleInfo.tokensLeft)
                    .dividedBy(Math.pow(10, this.state.tokenInfo.decimals))
                    .toString()} / ${
                  this.state.tokenInfo.totalSupply
                    .dividedBy(Math.pow(10, this.state.tokenInfo.decimals))
                    .toString()
                  } ${
                  this.state.tokenInfo.symbol
                  } Sold` : ""}
              </p>
              <p>
                Total raised: {this.state.web3 ? this.state.web3
                  .fromWei(this.state.saleInfo.balance).toString() : 0} ETH
                </p>
            </Progress>
            <Modal trigger={
              <Button style={{ margin: 'auto', marginTop: 50 }} size='huge'>
                Buy token with ETH
              </Button>
            } size='small'>
              <Modal.Header>Buy Token</Modal.Header>
              <Modal.Content>
                <p>Form</p>
              </Modal.Content>
              <Modal.Actions>
                <Button icon='check' content='All Done' />
              </Modal.Actions>
            </Modal>
          </Grid>
        </Segment>
        <Segment style={{ padding: '0em' }} vertical>
          <Grid celled='internally' columns='equal' stackable>
            <Grid.Row textAlign='center'>
              <Grid.Column style={{ paddingBottom: '5em', paddingTop: '5em' }}>
                <Header as='h3' style={{ fontSize: '2em' }}>Tokensale Information</Header>
                <p style={{ fontSize: '1.33em' }}>
                  Sale Price: {this.state.saleInstance ?
                    `${new bn(1)
                      .dividedBy(this.state.web3.fromWei(this.state.saleInfo.salePrice))
                      .dividedBy(Math.pow(10, this.state.tokenInfo.decimals))
                      .toString()} ${this.state.tokenInfo.symbol} / ETH`
                    : "..."}
                </p>
                <p style={{ fontSize: '1.33em' }}>
                  Total Supply: {this.state.saleInstance ?
                    `${this.state.tokenInfo.totalSupply
                      .dividedBy(Math.pow(10, this.state.tokenInfo.decimals))
                      .toString()} ${this.state.tokenInfo.symbol}`
                    : 0}
                </p>
              </Grid.Column>
              <Grid.Column style={{ paddingBottom: '5em', paddingTop: '5em' }}>
                <Header as='h3' style={{ fontSize: '2em' }}>Contribution Period</Header>
                <p style={{ fontSize: '1.33em' }}>
                  Start: {this.state.saleInfo.saleStartTime ?
                    this.state.saleInfo.saleStartTime.toLocaleString()
                    : null}
                </p>
                <p style={{ fontSize: '1.33em' }}>
                  End: {this.state.saleInfo.saleEndTime ?
                    this.state.saleInfo.saleEndTime.toLocaleString()
                    : null}
                </p>
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </Segment>
      </div>
    )
  }
}

// class App extends Component {
//   constructor(props) {
//     super(props)

//     this.state = {
//       web3: null,
//       account: null,
//       networkID: null,
//       saleInstance: null,
//       tokenInstance: null,
//       tokenInfo: {
//         name: null,
//         decimals: null,
//         symbol: null,
//         tradableAfter: null,
//         totalSupply: null,
//         tokenSeller: null,
//       },
//       saleInfo: {
//         saleStartTime: null,
//         saleEndTime: null,
//         salePrice: null,
//         tokensLeft: null,
//         balance: null,
//       },
//       investEth: "",
//     }
//   }

//   componentWillMount = async () => {
//     let web3, networkID, account
//     try {
//       web3 = await getWeb3()
//       Bluebird.promisifyAll(web3.eth, { suffix: "Promise" })
//       Bluebird.promisifyAll(web3.version, { suffix: "Promise" })
//       networkID = await web3.version.getNetworkPromise()
//       account = (await web3.eth.getAccountsPromise())[0]
//     } catch (err) {
//       console.error(err)
//       alert("cannot load web3! do you have metamask running?")
//       return
//     }

//     this.setState({
//       web3,
//       networkID,
//       account
//     })

//     await this.instantiateContract()
//   }

//   instantiateContract = async () => {
//     const Tokensale = TruffleContract(BasicTokensaleArtifact)
//     Tokensale.setProvider(this.state.web3.currentProvider)
//     const saleInstance = Tokensale.at(SaleAddr)
//     const Token = TruffleContract(ICOableTokenArtifact)
//     Token.setProvider(this.state.web3.currentProvider)
//     const tokenInstance = Token.at(TokenAddr)
//     // get info about token
//     const name = await tokenInstance.name()
//     const decimals = await tokenInstance.decimals()
//     const symbol = await tokenInstance.symbol()
//     const tradableAfter = new Date((await tokenInstance.tradableAfter()) * 1000)
//     const totalSupply = await tokenInstance.totalSupply()
//     const tokenSeller = await tokenInstance.tokenSeller()
//     // get info about tokensale
//     const saleStartTime = new Date((await saleInstance.saleStartTime()) * 1000)
//     const saleEndTime = new Date((await saleInstance.saleEndTime()) * 1000)
//     const salePrice = await saleInstance.salePrice()
//     const tokensLeft = await tokenInstance
//       .allowance(tokenSeller, saleInstance.address)
//     const balance = await this.state.web3.eth.getBalancePromise(saleInstance.address)
//     this.setState({
//       tokenInstance,
//       saleInstance,
//       tokenInfo: {
//         name,
//         decimals,
//         symbol,
//         tradableAfter,
//         totalSupply,
//         tokenSeller,
//       },
//       saleInfo: {
//         saleStartTime,
//         saleEndTime,
//         salePrice,
//         tokensLeft,
//         balance,
//       }
//     })
//   }

//   handleBuyClick = async () => {
//     const tx = await this.state.saleInstance.sendTransaction({
//       from: this.state.account,
//       value: this.state.web3.toWei(this.state.investEth),
//     })
//     console.log(tx)
//     if (tx.logs[0].event === "TokenSold") {
//       // success
//       alert("success! you bought the tokens!")
//       console.log(tx.logs[0].args)
//     } else {
//       alert("failed!")
//     }
//   }

//   handleCashoutClick = async () => {
//     const tx = await this.state.saleInstance.withdraw({
//       from: this.state.account,
//     })
//     console.log(tx)
//   }

//   render() {
//     return (
//       <div className="App">
//         <nav className="navbar pure-menu pure-menu-horizontal">
//           <a href="#" className="pure-menu-heading pure-menu-link">Buy my ICO</a>
//         </nav>

//         <main className="container">
//           <div className="pure-g">
//             <div className="pure-u-1-1">
//               <h1>Disclaimers</h1>
//               <p>Guaranteed 10x return!</p>
//               <p>don't participate in the ico if ur a US individual</p>
//               <p>insert some generic disclaimers here</p>
//               {this.state.saleInstance ? (
//                 <div>
//                   <h2>Version Info</h2>
//                   <p>You are on <strong>{this.state.networkID === 1 ? "mainnet" : "testnet"}</strong>
//                     {" "}({this.state.networkID}).</p>
//                   <p>Token address: <strong>{this.state.tokenInstance.address}</strong></p>
//                   <p>Sale address: <strong>{this.state.saleInstance.address}</strong></p>
//                   <p>Your address: <strong>{this.state.account}</strong></p>
//                 </div>
//               ) : <p>web3 is loading!</p>}
//             </div>
//             <hr />
//             {this.state.saleInstance ? (
//               <div className="pure-u-1-1">
//                 <h1>{this.state.tokenInfo.name} ({this.state.tokenInfo.symbol}) Tokensale</h1>
//                 <p>Total Supply: {this.state.tokenInfo.totalSupply
//                   .dividedBy(Math.pow(10, this.state.tokenInfo.decimals))
//                   .toString()}
//                 </p>
//                 <p>Tokens Left: {this.state.saleInfo.tokensLeft
//                   .dividedBy(Math.pow(10, this.state.tokenInfo.decimals))
//                   .toString()}
//                 </p>
//                 <p>Start Time: {this.state.saleInfo.saleStartTime.toLocaleString()}</p>
//                 <p>End Time: {this.state.saleInfo.saleEndTime.toLocaleString()}</p>
//                 <p>Sale Price: {new bn(1)
//                   .dividedBy(this.state.web3.fromWei(this.state.saleInfo.salePrice))
//                   .dividedBy(Math.pow(10, this.state.tokenInfo.decimals)).toString()}
//                   {`${this.state.tokenInfo.symbol} / ETH`}</p>
//                 <h2>buy the shit now and get rich</h2>
//                 <div>
//                   <label>
//                     I'm investing
//                     <input onChange={(e) => {
//                       this.setState({ investEth: e.target.value })
//                     }} /> ETH
//                   </label>
//                   <p>
//                     {isNaN(this.state.investEth) || !this.state.investEth ? "Enter a number!"
//                       :
//                       `This will get you ${new bn(this.state.web3.toWei(this.state.investEth))
//                         .dividedBy(this.state.saleInfo.salePrice)
//                         .dividedBy(Math.pow(10, this.state.tokenInfo.decimals))}
//                         ${this.state.tokenInfo.symbol}`}
//                   </p>
//                   <button onClick={this.handleBuyClick}>buy the ico</button>
//                 </div>
//               </div>
//             ) : null}
//             {this.state.account && this.state.account === this.state.tokenInfo.tokenSeller ? (
//               <div className="pure-u-1-1">
//                 <h1>Seller controls</h1>
//                 <p>Balance of the tokensale contract: {this.state.web3
//                   .fromWei(this.state.saleInfo.balance).toString()} ETH</p>
//                 <button onClick={this.handleCashoutClick}>Cash out!</button>
//               </div>
//             ) : null}
//           </div>
//         </main>
//       </div>
//     );
//   }
// }

export default App;
