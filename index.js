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
 * - Unknown (0)
 * - Preparing (1): All contract initialization calls and variables have not been set yet
 * - Prefunding (2): We have not passed start time yet
 * - Funding (3): Active crowdsale
 * - Success (4): Minimum funding goal reached
 * - Failure (5): Minimum funding goal not reached before ending time
 * - Finalized (6): The finalized has been called and succesfully executed
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

  console.log("minimum funding goal:", await crowdsale.returnCurrency("qtum", "minimumFundingGoal"))
  console.log("minimum funding goal reached:", await crowdsale.return("isMinimumGoalReached"))

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

/**
 * Finalize a crowdsale
 */
async function finalize() {
  const finalized = await crowdsale.return("finalized")

  if (finalized) {
    throw new Error("crowdsale is already finalized")
  }

  const tx = await crowdsale.send("finalize")
  const receipt = await tx.confirm(1)
  console.log("finalize receipt:", receipt)
}

/**
 * Set crowdsale's end date to 1 minute from.
 */
async function endCrowdsaleNow() {
  const nowDate = new Date()
  // The fudge factor 60s may need to be larger on the real network, where there may be a clock skew.
  const now = Math.floor(nowDate / 1000) + 60
  const tx = await crowdsale.send("setEndsAt", [now])
  const receipt = await tx.confirm(1)
  console.log("end now receipt:")
  console.log(JSON.stringify(receipt, null, 2))
}

/**
 * Finalize the Crowdsale
 */
async function finalizeCrowdsale() {
  crowdsale.finalized()
  const tx = await crowdsale.send("finalize")
  const receipt = await tx.confirm(1)
  console.log("receipt")
  console.log(JSON.stringify(receipt, null, 2))
}

/**
 * Load Refund
 */
async function loadRefund() {
  const amountRaised = await crowdsale.returnCurrency("qtum", "weiRaised")

  const loadedRefund = await crowdsale.returnCurrency("qtum", "loadedRefund")

  const amountToLoad = amountRaised - loadedRefund

  console.log("amount to load as refund", amountToLoad)

  if (amountToLoad > 0) {
    const tx = await crowdsale.send("loadRefund", [], {
      amount: amountToLoad,
    })
    console.log("tx:", tx)
    const receipt = await tx.confirm(1)
    console.log("receipt", receipt)
  }
}

/**
 * Refund to address
 *
 * @param {string} addr
 */
async function refund(addr) {
  const tx = await crowdsale.send("refund", [], {
    senderAddress: addr,
  })
  const receipt = await tx.confirm(1)
  console.log("receipt", receipt)
}

// debug contract state
async function logState() {
  const tx = await crowdsale.send("logState")
  const receipt = await tx.confirm(1)
  console.log(JSON.stringify(receipt, null, 2))
}

/**
 * Get the token balance of an address
 *
 * @param {string} address
 */
async function balanceOf(address) {
  const balance = await mytoken.return("balanceOf", [address])

  console.log("balance:", balance)
}

async function transfer(fromAddr, toAddr, amount) {
  const tx = await mytoken.send("transfer", [toAddr, amount], {
    senderAddress: fromAddr,
  })

  console.log("transfer tx:", tx.txid)
  console.log(tx)

  const receipt = await tx.confirm(1)
  console.log("receipt", receipt)
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
    case "finalize":
      await finalize()
      break
    case "endnow":
      await endCrowdsaleNow()
      break
    case "loadRefund":
      await loadRefund()
      break
    case "refund":
      await refund(argv[1])
      break
    case "state":
      await logState()
      break
    case "balanceOf":
      await balanceOf(argv[1])
      break
    case "transfer":
      // fromAddr, toAddr, amount
      await transfer(argv[1], argv[2], argv[3])
      break
    default:
      console.log("unrecognized command", cmd)
  }
}

main().catch((err) => {
  console.log("err", err)
})
