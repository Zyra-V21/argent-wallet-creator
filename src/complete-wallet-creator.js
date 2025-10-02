#!/usr/bin/env node

const { RpcProvider, Account, Contract, CallData, ec, stark, hash, cairo, constants } = require('starknet')
const fs = require('fs')
const { execSync } = require('child_process')
const path = require('path')

// Load environment variables
require('dotenv').config()

// ⚠️ 🚨 CRITICAL SECURITY WARNING 🚨 ⚠️
// THIS CODE STORES PRIVATE KEYS IN LOCAL DATABASE
// ❌ NEVER USE IN PRODUCTION - DEVELOPMENT ONLY ❌
// FOR PRODUCTION: USE NON-CUSTODIAL ARCHITECTURE
console.warn('⚠️  SECURITY WARNING: This is a development-only MVP that stores private keys locally!')
console.warn('❌ NEVER use in production environments - implement non-custodial architecture instead')

// Configuración desde variables de entorno
const CONFIG = {
  RPC_URL: process.env.STARKNET_RPC_URL || 'https://starknet-sepolia.public.blastapi.io',
  MASTER_ADDRESS: process.env.MASTER_ACCOUNT_ADDRESS,
  STRK_TOKEN_ADDRESS: process.env.STRK_TOKEN_ADDRESS,
  ARGENT_ACCOUNT_CLASS_HASH: process.env.ARGENT_ACCOUNT_CLASS_HASH,
  FUNDING_AMOUNT: process.env.FUNDING_AMOUNT || '100000000000000000', // 0.1 STRK in wei
  DB_FILE: process.env.WALLETS_DB_FILE || './data/wallets-db.json',
  NETWORK: process.env.NETWORK || 'sepolia'
}

// Validar que todas las variables requeridas estén presentes
const requiredVars = ['MASTER_ACCOUNT_ADDRESS', 'STRK_TOKEN_ADDRESS', 'ARGENT_ACCOUNT_CLASS_HASH']
for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.error(`❌ Missing required environment variable: ${varName}`)
    console.error('Please check your .env file')
    process.exit(1)
  }
}

class CompleteWalletCreator {
  constructor() {
    this.provider = new RpcProvider({ nodeUrl: CONFIG.RPC_URL })
    this.wallets = this.loadWallets() || [] // Ensure it's always an array
  }

  loadWallets() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(CONFIG.DB_FILE)
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
      }
      
      if (fs.existsSync(CONFIG.DB_FILE)) {
        const data = fs.readFileSync(CONFIG.DB_FILE, 'utf8')
        const parsed = JSON.parse(data)
        return Array.isArray(parsed) ? parsed : []
      }
    } catch (error) {
      console.warn('⚠️  Could not load wallets DB:', error.message)
    }
    return []
  }

  saveWallets() {
    try {
      fs.writeFileSync(CONFIG.DB_FILE, JSON.stringify(this.wallets, null, 2))
    } catch (error) {
      console.error('❌ Could not save wallets DB:', error.message)
    }
  }

  /**
   * Crea una wallet completa: genera, fondea y despliega
   */
  async createCompleteWallet(userId) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`🆕 Creating complete wallet for: ${userId}`)
    
    try {
      // 1. Generar keypair
      console.log('🔑 Generating keypair...')
      const privateKey = stark.randomAddress()
      const publicKey = ec.starkCurve.getStarkKey(privateKey)
      
      // 2. Usar starkli para generar la configuración y obtener la dirección correcta
      console.log('📐 Generating Argent account config with starkli...')
      const tempConfigFile = `/tmp/argent_config_${Date.now()}.json`
      
      // Generar configuración con starkli (capturar stderr también)
      const starkliInitCmd = `starkli account argent init --private-key ${privateKey} ${tempConfigFile} 2>&1`
      const starkliResult = execSync(starkliInitCmd, { encoding: 'utf8' })
      
      // Extraer la dirección correcta del output de starkli
      // Buscar cualquier dirección de Starknet (patrón más permisivo)
      let addresses = starkliResult.match(/0x[a-fA-F0-9]{60,66}/g)
      
      if (!addresses || addresses.length === 0) {
        // Intentar con patrón más amplio
        addresses = starkliResult.match(/0x[a-fA-F0-9]{40,}/g)
      }
      
      if (!addresses || addresses.length === 0) {
        console.log('🔍 DEBUG - Full starkli output:')
        console.log('---START---')
        console.log(starkliResult)
        console.log('---END---')
        console.log('🔍 DEBUG - Output length:', starkliResult.length)
        console.log('🔍 DEBUG - Contains 0x?', starkliResult.includes('0x'))
        throw new Error('Could not extract address from starkli output')
      }
      
      // Tomar la dirección más larga (debería ser la cuenta)
      const accountAddress = addresses.reduce((a, b) => a.length > b.length ? a : b)
      console.log(`✅ Starknet L2 Wallet Address: ${accountAddress}`)
      console.log(`🔗 https://sepolia.starkscan.co/contract/${accountAddress}`)
      
      // 3. Funding wallet with 0.1 STRK
      console.log(`\n💸 Funding wallet with 0.1 STRK...`)
      
      const sncastCmd = `sncast -a invisible_wallet invoke --network ${CONFIG.NETWORK} --contract-address ${CONFIG.STRK_TOKEN_ADDRESS} --function transfer --calldata ${accountAddress} ${CONFIG.FUNDING_AMOUNT} 0x0`
      
      console.log(`🔧 Using sncast: ${sncastCmd}`)
      
      const result = execSync(sncastCmd, { encoding: 'utf8' })
      console.log('📤 sncast result:', result)
      
      // Extract transaction hash from sncast output
      let hashMatch = result.match(/Transaction Hash: (0x[a-fA-F0-9]+)/)
      if (!hashMatch) {
        hashMatch = result.match(/transaction_hash: (0x[a-fA-F0-9]+)/)
      }
      const transaction_hash = hashMatch ? hashMatch[1] : 'unknown'
        
      console.log(`✅ STRK transfer TX: ${transaction_hash}`)
      console.log(`🔗 https://sepolia.starkscan.co/tx/${transaction_hash}`)
      
      // 4. Esperar confirmación del funding
      console.log('⏳ Waiting for funding confirmation...')
      try {
        await this.provider.waitForTransaction(transaction_hash, {
          retryInterval: 10000,
          successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1']
        })
        console.log('✅ Funding confirmed!')
      } catch (waitError) {
        console.warn('⚠️  Funding confirmation timeout - proceeding with deploy')
      }
      
      // Wait additional time for balance to update
      console.log('⏳ Waiting for balance update (30s)...')
      await new Promise(resolve => setTimeout(resolve, 30000))
      
      // 5. Verificar balance
      console.log('\n💰 Checking account balance...')
      
      let accountBalance = BigInt(0)
      try {
        const sncastBalanceCmd = `sncast call --network ${CONFIG.NETWORK} --contract-address ${CONFIG.STRK_TOKEN_ADDRESS} --function balanceOf --calldata ${accountAddress}`
        const sncastResult = execSync(sncastBalanceCmd, { encoding: 'utf8' })
        console.log('📤 sncast balance result:', sncastResult)
        
        // Parse "Response: 100000000000000000_u256"
        const balanceMatch = sncastResult.match(/Response:\s+(\d+)_u256/)
        if (balanceMatch) {
          accountBalance = BigInt(balanceMatch[1])
          const balanceInStrk = Number(accountBalance) / (10**18)
          console.log(`💰 Account balance: ${balanceInStrk.toFixed(4)} STRK`)
        } else {
          console.warn('⚠️  Could not parse balance from sncast result')
        }
      } catch (sncastError) {
        console.warn('⚠️  Balance check failed:', sncastError.message)
      }
      
      if (accountBalance === BigInt(0)) {
        throw new Error('Account has insufficient balance for deployment')
      }
      
      // 6. Deploy usando starkli account deploy
      console.log('\n🚀 Deploying account using starkli account deploy...')
      
      const deployCmd = `starkli account deploy ${tempConfigFile} --private-key ${privateKey} --network ${CONFIG.NETWORK} 2>&1`
      
      console.log('🔧 Deploy command:', deployCmd.replace(privateKey, '***PRIVATE_KEY***'))
      const deployResult = execSync(deployCmd, { encoding: 'utf8' })
      console.log('📤 Deploy result:', deployResult)
      
      // Extract transaction hash del deploy (buscar en todo el output)
      let deployHashMatch = deployResult.match(/Account deployment transaction: (0x[a-fA-F0-9]+)/)
      if (!deployHashMatch) {
        deployHashMatch = deployResult.match(/Transaction (0x[a-fA-F0-9]+) confirmed/)
      }
      if (!deployHashMatch) {
        // Buscar cualquier hash de transacción largo
        const allHashes = deployResult.match(/0x[a-fA-F0-9]{60,}/g)
        if (allHashes && allHashes.length > 0) {
          deployHashMatch = [null, allHashes[0]]
        }
      }
      
      const deployTxHash = deployHashMatch ? deployHashMatch[1] : 'unknown'
      
      console.log(`✅ Account deployed via starkli! TX: ${deployTxHash}`)
      console.log(`🔗 https://sepolia.starkscan.co/tx/${deployTxHash}`)
      
      // 7. Guardar wallet en BD
      const walletData = {
        userId,
        address: accountAddress,
        privateKey,
        publicKey,
        fundingTx: transaction_hash,
        deployTx: deployTxHash,
        balance: '0.1000',
        status: 'deployed',
        createdAt: new Date().toISOString()
      }
      
      this.wallets.push(walletData)
      this.saveWallets()
      
      // Cleanup temp file
      try {
        fs.unlinkSync(tempConfigFile)
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      console.log(`\n🎉 WALLET CREATION COMPLETE!`)
      console.log(`   User: ${userId}`)
      console.log(`   Address: ${accountAddress}`)
      console.log(`   Funding TX: ${transaction_hash}`)
      console.log(`   Deploy TX: ${deployTxHash}`)
      console.log(`   Status: DEPLOYED ✅`)
      console.log(`   🔗 DEPLOYED WALLET: https://sepolia.starkscan.co/contract/${accountAddress}`)
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
      
      return walletData
      
    } catch (error) {
      console.error('❌ Complete wallet creation failed:', error.message)
      throw error
    }
  }

  async listWallets() {
    console.log('\n📋 WALLET DATABASE:')
    console.log(`Total wallets: ${this.wallets.length}`)
    
    this.wallets.forEach((wallet, index) => {
      console.log(`\n${index + 1}. ${wallet.userId}`)
      console.log(`   Address: ${wallet.address}`)
      console.log(`   Status: ${wallet.status || 'unknown'}`)
      console.log(`   Balance: ${wallet.balance} STRK`)
      console.log(`   Created: ${wallet.createdAt}`)
      if (wallet.deployTx) {
        console.log(`   🔗 https://sepolia.starkscan.co/contract/${wallet.address}`)
      }
    })
    console.log('')
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log('\n🔮 Complete Wallet Creator')
    console.log('Usage:')
    console.log('  node complete-wallet-creator.js create <userId>')
    console.log('  node complete-wallet-creator.js list')
    console.log('')
    return
  }

  const creator = new CompleteWalletCreator()

  try {
    if (args[0] === 'create' && args[1]) {
      await creator.createCompleteWallet(args[1])
    } else if (args[0] === 'list') {
      await creator.listWallets()
    } else {
      console.log('❌ Invalid command. Use "create <userId>" or "list"')
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = CompleteWalletCreator
