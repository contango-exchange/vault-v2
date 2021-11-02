import { constants, id } from '@yield-protocol/utils-v2'
const { WAD } = constants
import { ETH, DAI, WSTETH, STETH } from '../src/constants'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { LidoOracle } from '../typechain/LidoOracle'
import { LidoMock } from '../typechain/LidoMock'
import { ChainlinkAggregatorV3Mock } from '../typechain/ChainlinkAggregatorV3Mock'
import { ChainlinkMultiOracle } from '../typechain/ChainlinkMultiOracle'
import { CompositeMultiOracle } from '../typechain/CompositeMultiOracle'
import { WETH9Mock } from '../typechain/WETH9Mock'
import { STETHMock } from '../typechain/STETHMock'
import LidoOracleArtifact from '../artifacts/contracts/oracles/lido/LidoOracle.sol/LidoOracle.json'
import LidoMockArtifact from '../artifacts/contracts/mocks/oracles/lido/LidoMock.sol/LidoMock.json'
import ChainlinkAggregatorV3MockArtifact from '../artifacts/contracts/mocks/oracles/chainlink/ChainlinkAggregatorV3Mock.sol/ChainlinkAggregatorV3Mock.json'
import ChainlinkMultiOracleArtifact from '../artifacts/contracts/oracles/chainlink/ChainlinkMultiOracle.sol/ChainlinkMultiOracle.json'
import CompositeMultiOracleArtifact from '../artifacts/contracts/oracles/composite/CompositeMultiOracle.sol/CompositeMultiOracle.json'
import WETH9MockArtifact from '../artifacts/contracts/mocks/WETH9Mock.sol/WETH9Mock.json'
import STETHMockArtifact from '../artifacts/contracts/mocks/STETHMock.sol/STETHMock.json'
import { ethers, waffle } from 'hardhat'
import { expect } from 'chai'
import { parseEther } from '@ethersproject/units'

const { deployContract } = waffle

function bytes6ToBytes32(x: string): string {
  return x + '00'.repeat(26)
}

describe('Oracles - Lido', function () {
  this.timeout(0)

  let ownerAcc: SignerWithAddress
  let owner: string
  let weth: WETH9Mock
  let steth: STETHMock
  let lidoOracle: LidoOracle
  let lidoMock: LidoMock
  let chainlinkMultiOracle: ChainlinkMultiOracle
  let compositeMultiOracle: CompositeMultiOracle
  let stethEthAggregator: ChainlinkAggregatorV3Mock
  const mockBytes6 = ethers.utils.hexlify(ethers.utils.randomBytes(6))

  before(async () => {
    const signers = await ethers.getSigners()
    ownerAcc = signers[0]
    owner = await ownerAcc.getAddress()
    lidoMock = (await deployContract(ownerAcc, LidoMockArtifact)) as LidoMock
    await lidoMock.set('1008339308050006006')

    weth = (await deployContract(ownerAcc, WETH9MockArtifact)) as WETH9Mock
    steth = (await deployContract(ownerAcc, STETHMockArtifact)) as STETHMock

    chainlinkMultiOracle = (await deployContract(ownerAcc, ChainlinkMultiOracleArtifact, [])) as ChainlinkMultiOracle
    await chainlinkMultiOracle.grantRole(
      id(chainlinkMultiOracle.interface, 'setSource(bytes6,address,bytes6,address,address)'),
      owner
    )

    stethEthAggregator = (await deployContract(
      ownerAcc,
      ChainlinkAggregatorV3MockArtifact
    )) as ChainlinkAggregatorV3Mock

    //Set stETH/ETH chainlink oracle
    await chainlinkMultiOracle.setSource(STETH, steth.address, ETH, weth.address, stethEthAggregator.address)
    await stethEthAggregator.set('992415619690099500')

    lidoOracle = (await deployContract(ownerAcc, LidoOracleArtifact, [
      bytes6ToBytes32(WSTETH),
      bytes6ToBytes32(STETH),
    ])) as LidoOracle
    await lidoOracle.grantRole(id(lidoOracle.interface, 'setSource(address)'), owner)
    await lidoOracle['setSource(address)'](lidoMock.address) //mockOracle

    compositeMultiOracle = (await deployContract(ownerAcc, CompositeMultiOracleArtifact)) as CompositeMultiOracle
    compositeMultiOracle.grantRoles(
      [
        id(compositeMultiOracle.interface, 'setSource(bytes6,bytes6,address)'),
        id(compositeMultiOracle.interface, 'setPath(bytes6,bytes6,bytes6[])'),
      ],
      owner
    )
    // Set up the CompositeMultiOracle to draw from the ChainlinkMultiOracle
    await compositeMultiOracle.setSource(WSTETH, STETH, lidoOracle.address)
    await compositeMultiOracle.setSource(STETH, ETH, chainlinkMultiOracle.address)

    //Set path for wsteth-steth-eth
    await compositeMultiOracle.setPath(WSTETH, ETH, [STETH])
  })

  it('sets and retrieves the value at spot price', async () => {
    expect((await lidoOracle.callStatic.get(bytes6ToBytes32(STETH), bytes6ToBytes32(WSTETH), WAD))[0]).to.equal(
      '991729660855795538'
    )
    expect(
      (await lidoOracle.callStatic.get(bytes6ToBytes32(WSTETH), bytes6ToBytes32(STETH), parseEther('1')))[0]
    ).to.equal('1008339308050006006')
  })

  it('revert on unknown sources', async () => {
    await expect(lidoOracle.callStatic.get(bytes6ToBytes32(DAI), bytes6ToBytes32(mockBytes6), WAD)).to.be.revertedWith(
      'Source not found'
    )
  })

  describe('Composite', () => {
    it('retrieves the value at spot price for direct pairs', async () => {
      expect(
        (await compositeMultiOracle.peek(bytes6ToBytes32(WSTETH), bytes6ToBytes32(STETH), parseEther('1')))[0]
      ).to.equal('1008339308050006006')
      expect(
        (await compositeMultiOracle.peek(bytes6ToBytes32(STETH), bytes6ToBytes32(ETH), parseEther('1')))[0]
      ).to.equal('992415619690099500')
      expect(
        (await compositeMultiOracle.peek(bytes6ToBytes32(STETH), bytes6ToBytes32(WSTETH), parseEther('1')))[0]
      ).to.equal('991729660855795538')
      expect(
        (await compositeMultiOracle.peek(bytes6ToBytes32(ETH), bytes6ToBytes32(STETH), parseEther('1')))[0]
      ).to.equal('1007642342743727538')
    })

    it('retrieves the value at spot price for WSTETH -> ETH and reverse', async () => {
      expect(
        (await compositeMultiOracle.peek(bytes6ToBytes32(WSTETH), bytes6ToBytes32(ETH), parseEther('1')))[0]
      ).to.equal('1000691679256332845')

      expect(
        (await compositeMultiOracle.peek(bytes6ToBytes32(ETH), bytes6ToBytes32(WSTETH), parseEther('1')))[0]
      ).to.equal('999308798833176199')
    })
  })
})