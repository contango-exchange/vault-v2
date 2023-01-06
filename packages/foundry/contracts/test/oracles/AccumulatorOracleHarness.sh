ARBITRUM_ORACLE="0x0ad9Ef93673B6081c0c3b753CcaaBDdd8d2e7848"

ARBITRUM_BASES=(\
    ["0x303000000000"]="0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
    ["0x303100000000"]="0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"
    ["0x303200000000"]="0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"
    ["0x313800000000"]="0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F"
)

MAINNET_ORACLE="0x95750d6F5fba4ed1cc4Dc42D2c01dFD3DB9a11eC"

MAINNET_BASES=(\
    ["0x303000000000"]="0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    ["0x303100000000"]="0x6B175474E89094C44Da98b954EedeAC495271d0F"
    ["0x303200000000"]="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    ["0x313800000000"]="0x853d955aCEf822Db058eb8505911ED77F175b99e"
)

export CI=false
export RPC="MAINNET"
export NETWORK="MAINNET"
export MOCK=false

for token in ${!MAINNET_BASES[@]}; do
   echo     "Oracle:    " $MAINNET_ORACLE
   printf   "Base:       %x\n" $token
   echo     "Address:   " ${MAINNET_BASES[$token]}
   ORACLE=$MAINNET_ORACLE BASE=$(printf "%x" $token) ADDRESS=${MAINNET_BASES[$token]} forge test -c contracts/test/oracles/AccumulatorOracle.t.sol
done 
