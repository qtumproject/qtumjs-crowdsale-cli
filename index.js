const { Qtum } = require("qtumjs")

const repoData = require("./solar.development.json")

const qtum = new Qtum("http://qtum:test@localhost:3889", repoData)

const mytoken = qtum.contract("MyToken")
const crowdsale = qtum.contract("Crowdsale")
const finalizeAgent = qtum.contract("FinalizeAgent")

const nullAddress = "0000000000000000000000000000000000000000" // i.e. 0x0

/**
 * Return the current state of the crowdsale
 *
 * - Preparing: All contract initialization calls and variables have not been set yet
 * - Prefunding: We have not passed start time yet
 * - Funding: Active crowdsale
 * - Success: Minimum funding goal reached
 * - Failure: Minimum funding goal not reached before ending time
 * - Finalized: The finalized has been called and succesfully executed
 * - Refunding: Refunds are loaded on the contract for reclaim
 *
 * @param state {number} the state of a crowdsale, as number
 * @returns string the string name of state
 */
function stateName(state) {
  const stateNames = [
    "Unknown", "Preparing", "PreFunding", "Funding", "Success", "Failure", "Finalized", "Refunding"
  ]

  return stateNames[state]
}

async function showinfo() {
  console.log("token supply:", await mytoken.return("totalSupply"))
  console.log("crowdsale state:", await crowdsale.returnAs(stateName, "getState"))
  console.log("crowdsale start date:", await crowdsale.returnDate("startsAt"))
  console.log("crowdsale end date:", await crowdsale.returnDate("endsAt"))

  console.log("investor count:", await crowdsale.return("investorCount"))
  console.log("qtum raised:", await crowdsale.returnCurrency("qtum", "weiRaised"))
  console.log("tokens sold:", await crowdsale.return("tokensSold"))

  console.log(`
The crowdsale state returned by callcontract does not reflect the actual state because
block.timestamp is always 0 when calling a contract. This will be fixed in Issue #480.

See https://github.com/qtumproject/qtum/issues/480
`)

}

/**
 * Configure crowdsale to make it ready for funding
 */
async function setupCrowdsale() {
  // set finalize agent as token's release agent
  if (await mytoken.return("releaseAgent") !== finalizeAgent.address) {
    let tx = await mytoken.send("setReleaseAgent", [finalizeAgent.address])
    console.log("confirming mytoken.setReleaseAgent:", tx.txid)
    let receipt = await tx.confirm(1)
    console.log("mytoken.setReleaseAgent receipt", receipt)
  }
  console.log("releaseAgent coinfigured")

  // set crowdsale's finalize agent
  if (await crowdsale.return("finalizeAgent") !== finalizeAgent.address) {
    tx = await crowdsale.send("setFinalizeAgent", [finalizeAgent.address])
    console.log("confirming crowdsale.setFinalizeAgent:", tx.txid)
    receipt = await tx.confirm(1)
    console.log("crowdsale.setFinalizeAgent receipt", receipt)
  }
  console.log("finalizeAgent coinfigured")

  // The mint agent of the token should be the crowdsale contract.
  // `true` means this address is allow to mint. `false` to disable a mint agent.
  if (await mytoken.return("mintAgents", [crowdsale.address]) !== true) {
    tx = await mytoken.send("setMintAgent", [crowdsale.address, true])
    console.log("confirming mytoken.setMintAgent:", tx.txid)
    receipt = await tx.confirm(1)
    console.log("mytoken.setMintAgent receipt", receipt)
  }
  console.log("mintAgents coinfigured")
}

/**
 * Invest money in crowdsale
 *
 * @param address {string} receiver of tokens
 * @param amount {number} amount to invest (in qtum)
 */
async function invest(address, amount) {
  console.log("invest", address, amount)
  const tx = await crowdsale.send("invest", [address], {
    amount,
    gasLimit: 300000,
  })
  console.log("invest txid", tx.txid)
  const receipt = await tx.confirm(1)
  console.log("invest receipt:")
  console.log(JSON.stringify(receipt, null, 2))
}

/**
 * Invest money in crowdsale
 *
 * @param address {string} investor address
 */
async function investedBy(address) {
  const amount = await crowdsale.returnCurrency("qtum", "investedAmountOf", [address])
  console.log("invested by:", address)
  console.log("amount (qtum):", amount)
  const tokenBalance = await mytoken.return("balanceOf", [address])
  console.log("token balance:", tokenBalance)
}

/**
 * Presale allocation
 *
 * @param address {string} investor address
 */
async function preallocate(receiverAddress, tokens, price) {
  console.log("preallocate", receiverAddress, tokens, price)
  const tx = await crowdsale.send("preallocate", [receiverAddress, tokens, price])
  console.log("preallocate txid", tx.txid)
  const receipt = await tx.confirm(1)
  console.log("preallocate receipt:")
  console.log(JSON.stringify(receipt, null, 2))
}

async function main() {
  const argv = process.argv.slice(2)

  const cmd = argv[0]

  if (process.env.DEBUG) {
    console.log("argv", argv)
    console.log("cmd", cmd)
  }

  switch (cmd) {
    case "info":
      await showinfo()
      break
    case "setup":
      await setupCrowdsale()
      break
    case "preallocate":
      await preallocate(argv[1], parseInt(argv[2]), parseInt(argv[3]))
      break
    case "invest":
      await invest(argv[1], parseInt(argv[2]))
      break
    case "investedBy":
      await investedBy(argv[1])
      break
    default:
      console.log("unrecognized command", cmd)
  }
}

main().catch((err) => {
  console.log("err", err)
})
