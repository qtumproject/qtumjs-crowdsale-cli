#########################################################
# Generate an address to act as the owner of the contracts
#########################################################
#
# qcli getnewaddress
# qf292iYbjJ41oMoArA3PrHpxTdAHuQsuAu
#
# qcli gethexaddress qf292iYbjJ41oMoArA3PrHpxTdAHuQsuAu
# eb6a149ec16aaaa6e47b6c0048520f7d9563b20a

export QTUM_SENDER=qf292iYbjJ41oMoArA3PrHpxTdAHuQsuAu

#########################################################
# Deploy the contracts
#########################################################

solar deploy --force contracts/FlatPricing.sol '
[
  100000
]
'

solar deploy --force contracts/BurnableCrowdsaleToken.sol:MyToken '
[
  "MyToken",
  "MTK",
  30000000,
  0,
  true
]
'

solar deploy --force contracts/MintedTokenCappedCrowdsale.sol:Crowdsale '
[
  ${MyToken},
  ${contracts/FlatPricing.sol},
  "0xeb6a149ec16aaaa6e47b6c0048520f7d9563b20a",
  1515974400,
  1519862400,
  1200000000000,
  60000000
]
'

solar deploy --force contracts/DefaultFinalizeAgent.sol:FinalizeAgent '
[
  ${MyToken},
  ${Crowdsale}
]
'

#########################################################
# Configure the minter, finalizing agent, and release agent
#########################################################

node index.js setup

#########################################################
# Presale allocation
#########################################################

node index.js preallocate \
  77913e470293e72c1e93ed8dda8c1372dfc0274f \
  6000000 \
  50000

node index.js preallocate \
  78d55bb60f8c0e80fda479b02e40407ee0a88ab1 \
  4000000 \
  50000

#########################################################
# ICO investment
#########################################################

node index.js invest \
  6607919dd81d8e958b31e2ef089139505faada4d \
  7000

#########################################################
# End ICO early
#########################################################

node index.js endnow