#!/usr/bin/env node

/**
 * CEASER Backend - TX1 Executor
 * 
 * Este script monitorea operaciones pendientes y ejecuta TX1 automáticamente
 * usando la wallet pipilongo.
 */

const { RpcProvider, Account, Contract, CallData } = require('starknet')
require('dotenv').config()

// Configuración
const CONFIG = {
  RPC_URL: process.env.STARKNET_RPC_URL || 'https://starknet-sepolia.public.blastapi.io',
  PIPILONGO_ADDRESS: '0x5793e9a894be3af2bc4f13c12221d1b79b1fe4d31cf99836181d6e186c1bf3a',
  PIPILONGO_PRIVATE_KEY: process.env.PIPILONGO_PRIVATE_KEY || '',
  FEE_COLLECTOR_ADDRESS: '0x0089613106d681030ae543099c115196d76864bac9de81d1d30b9a7f63bc7da4',
  POLL_INTERVAL: 10000, // 10 seconds
}

// ABI simplificado para las funciones que necesitamos
const FEE_COLLECTOR_ABI = [
  {
    name: 'is_operation_ready',
    type: 'function',
    inputs: [{ name: 'operation_id', type: 'felt' }],
    outputs: [{ name: 'ready', type: 'felt' }],
    stateMutability: 'view'
  },
  {
    name: 'execute_mixing_with_destiny',
    type: 'function',
    inputs: [
      { name: 'operation_id', type: 'felt' },
      { name: 'destiny_address', type: 'felt' }
    ],
    outputs: [],
    stateMutability: 'external'
  }
]

class MixingExecutor {
  constructor() {
    this.provider = new RpcProvider({ nodeUrl: CONFIG.RPC_URL })
    this.account = new Account(this.provider, CONFIG.PIPILONGO_ADDRESS, CONFIG.PIPILONGO_PRIVATE_KEY, '1') // Cairo version 1
    this.feeCollector = new Contract(FEE_COLLECTOR_ABI, CONFIG.FEE_COLLECTOR_ADDRESS, this.provider)
    this.processedOperations = new Set()
    // NO PROCESS OLD OPERATIONS - Only listen for NEW events
    this.startTime = Date.now()
  }

  async start() {
    console.log('🚀 CEASER Backend Executor started')
    console.log('📍 Pipilongo:', CONFIG.PIPILONGO_ADDRESS)
    console.log('📍 FeeCollector:', CONFIG.FEE_COLLECTOR_ADDRESS)
    console.log('⏱️  Poll interval:', CONFIG.POLL_INTERVAL, 'ms')
    
    if (!CONFIG.PIPILONGO_PRIVATE_KEY) {
      console.error('❌ PIPILONGO_PRIVATE_KEY not set in environment')
      process.exit(1)
    }

    // Start monitoring loop
    this.monitorOperations()
  }

  async monitorOperations() {
    console.log('🔍 Starting REAL-TIME event monitoring...')
    console.log('⏰ Using StarkNet.js 2025 getEvents() polling approach...')
    
    let lastCheckedBlock = await this.provider.getBlockNumber()
    console.log(`📍 Starting from block: ${lastCheckedBlock} (only NEW operations)`)
    
    const checkForNewEvents = async () => {
      try {
        const currentBlock = await this.provider.getBlockNumber()
        
        if (currentBlock > lastCheckedBlock) {
          console.log(`🔍 Checking blocks ${lastCheckedBlock + 1} to ${currentBlock} for NEW events...`)
          
          try {
            // Use correct StarkNet.js getEvents method
            const events = await this.provider.getEvents({
              from_block: { block_number: lastCheckedBlock + 1 },
              to_block: { block_number: currentBlock },
              address: CONFIG.FEE_COLLECTOR_ADDRESS,
              keys: [
                ['0x18b8882595932a18c47181f1d223756628ee292caf284a494a4f70485bbc3f9'] // OperationCreated event selector
              ],
              chunk_size: 1000
            })

            if (events.events && events.events.length > 0) {
              console.log(`🆕 Found ${events.events.length} NEW events!`)
              
              for (const event of events.events) {
                const operationId = parseInt(event.data[0], 16)
                console.log(`🆕 NEW Operation detected: ${operationId}`)
                
                if (!this.processedOperations.has(operationId)) {
                  await this.checkOperation(operationId)
                }
              }
            }
          } catch (eventError) {
            // If getEvents fails, just continue (might be RPC issue)
            console.log(`⚠️ Event query failed: ${eventError.message}`)
          }
          
          lastCheckedBlock = currentBlock
        }
        
      } catch (error) {
        console.error('❌ Error in event monitoring:', error.message)
      }
      
      // Schedule next check
      setTimeout(checkForNewEvents, CONFIG.POLL_INTERVAL)
    }
    
    // Start monitoring
    checkForNewEvents()
  }
  
  fallbackPolling() {
    console.log('🔄 Using fallback polling method...')
    console.log('⏰ Only processing operations created AFTER backend start')
    
    const poll = async () => {
      console.log(`🔄 Heartbeat - Backend running for ${Math.round((Date.now() - this.startTime) / 1000)}s`)
      console.log('📢 Waiting for NEW operations from frontend...')
      
      // Don't poll old operations, just wait for new ones
      setTimeout(poll, CONFIG.POLL_INTERVAL)
    }
    
    poll()
  }

  async checkOperation(operationId) {
    try {
      // Skip if already processed
      if (this.processedOperations.has(operationId)) {
        return
      }

      // Check if operation is ready
      let isReady
      try {
        isReady = await this.feeCollector.is_operation_ready(operationId)
      } catch (error) {
        // Operation doesn't exist, skip
        return
      }
      
      if (!isReady) {
        return // Operation not ready
      }

      console.log(`✅ Found ready operation: ${operationId}`)

      // Skip getting operation details for now - just execute if ready
      console.log(`📋 Operation ${operationId} is ready - executing TX1...`)

      // For now, we need the destination address from the frontend API
      // In a real implementation, you'd get this from your database/API
      const destinationAddress = '0x02d4c0a53f31F0f359B5f439728A05273c23f0fA6FE2405A691DFd09FAfAFa49' // Default test address
      
      await this.executeTX1(operationId, destinationAddress)
      
    } catch (error) {
      console.error(`❌ Error checking operation ${operationId}:`, error.message)
    }
  }

  async executeTX1(operationId, destinationAddress) {
    try {
      console.log(`🚀 Executing TX1 for operation ${operationId}`)
      console.log(`📍 Destination: ${destinationAddress}`)

      // Execute TX1 with pipilongo account - Following StarkNet.js docs format
      const call = {
        contractAddress: CONFIG.FEE_COLLECTOR_ADDRESS,
        entrypoint: 'execute_mixing_with_destiny',
        calldata: CallData.compile({
          operation_id: operationId,
          destiny_address: destinationAddress
        })
      }

      // Use correct StarkNet.js v7+ syntax from docs
      const { transaction_hash } = await this.account.execute(call, {
        version: '0x3', // V3 transaction as string
        maxFee: '0x2625A00' // 40M wei max fee (increased for TX1)
      })

      console.log(`TX1 submitted: ${transaction_hash}`)
      console.log(`View: https://sepolia.starkscan.co/tx/${transaction_hash}`)

      // Mark as processed
      this.processedOperations.add(operationId)
      
      // Update current operation ID
      if (operationId >= this.currentOperationId) {
        this.currentOperationId = operationId + 1
      }

      // Notify frontend API about TX1 completion
      try {
        const fetch = await import('node-fetch').then(m => m.default)
        const response = await fetch('http://localhost:3000/api/mixing/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operationId: operationId.toString(),
            status: 'completed',
            tx1Hash: transaction_hash,
            txHash: transaction_hash
          })
        })
        
        if (response.ok) {
          console.log(`Frontend notified of TX1 completion for operation ${operationId}`)
        } else {
          console.warn(`Failed to notify frontend for operation ${operationId}`)
        }
      } catch (notifyError) {
        console.warn(`Frontend notification error for operation ${operationId}:`, notifyError.message)
      }

      // Wait for transaction confirmation with timeout
      try {
        await this.provider.waitForTransaction(transaction_hash, {
          retryInterval: 5000, // Check every 5 seconds
          successStates: ['ACCEPTED_ON_L2']
        })
        console.log(`TX1 confirmed for operation ${operationId}`)
      } catch (waitError) {
        console.warn(`TX1 submitted but confirmation failed for operation ${operationId}:`, waitError.message)
        // Transaction might still succeed, so we keep it as processed
      }

    } catch (error) {
      console.error(`❌ Failed to execute TX1 for operation ${operationId}:`)
      console.error('Error details:', error)
      
      // Don't mark as processed if execution failed
      this.processedOperations.delete(operationId)
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down CEASER Backend Executor...')
  process.exit(0)
})

// Start the executor
if (require.main === module) {
  const executor = new MixingExecutor()
  executor.start().catch(console.error)
}

module.exports = MixingExecutor
