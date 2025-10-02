# 🔮 Invisible Wallet Creator

Automated Starknet L2 wallet creation system that generates, funds, and deploys Argent wallets for seamless L1↔L2 bridge operations.

---


# ⚠️ 🚨 CRITICAL SECURITY WARNING 🚨 ⚠️

## 🔴 **THIS IS A DEVELOPMENT-ONLY MVP - NOT FOR PRODUCTION USE**

### **🚫 NEVER USE IN PRODUCTION ENVIRONMENTS**

**❌ STORING PRIVATE KEYS IN DATABASE IS EXTREMELY DANGEROUS**
- This MVP stores wallet private keys in a local JSON file
- **THIS IS ONLY FOR DEVELOPMENT AND TESTING PURPOSES**
- **NEVER deploy this to production servers**
- **NEVER use with real funds on mainnet**

### **🔒 FOR PRODUCTION, YOU MUST:**
1. **❌ DO NOT store private keys anywhere**
2. **✅ Use non-custodial wallet generation only**
3. **✅ Return only public addresses to users**
4. **✅ Let users control their own private keys**
5. **✅ Implement proper key management (HSM, hardware wallets)**
6. **✅ Use account abstraction for gasless transactions**

### **🎯 THIS MVP IS FOR:**
- ✅ Development and testing
- ✅ Understanding Starknet wallet creation flows
- ✅ Prototyping bridge mechanics
- ✅ Learning account abstraction concepts

### **🚨 PRODUCTION REQUIREMENTS:**
- Use proper key management systems
- Implement non-custodial architecture
- Follow security best practices
- Conduct security audits
- Use hardware security modules (HSM)

**⚡ YOU HAVE BEEN WARNED - USE AT YOUR OWN RISK ⚡**

---

## 🎯 What it does

This MVP creates **complete Argent wallets** on Starknet L2:
1. ✅ **Generates** cryptographic keypairs
2. ✅ **Calculates** correct Argent wallet addresses  
3. ✅ **Funds** wallets with 0.1 STRK for gas
4. ✅ **Deploys** wallets to Starknet
5. ✅ **Saves** all data to local database
6. ✅ **Returns** Sepolia Starkscan links

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- `sncast` (Starknet Foundry)
- `starkli` (Starknet CLI)

### Installation
```bash
npm install
cp .env.example .env  # Configure your environment
```

### Usage
```bash
# Create a new wallet
node index.js create <userId>

# List all wallets
node index.js list
```

## ⚙️ Configuration

All sensitive data is loaded from `.env`:

```env
# Starknet Configuration
STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io
MASTER_ACCOUNT_ADDRESS=0x...
STRK_TOKEN_ADDRESS=0x...
ARGENT_ACCOUNT_CLASS_HASH=0x...

# Wallet Settings
FUNDING_AMOUNT=100000000000000000  # 0.1 STRK in wei
WALLETS_DB_FILE=./data/wallets-db.json
NETWORK=sepolia
```

## 📁 Project Structure

```
invisible-wallet/
├── src/
│   └── complete-wallet-creator.js  # Main wallet creation logic
├── data/
│   └── wallets-db.json            # Wallet database
├── scripts/
│   └── mixing-executor.js         # Reference implementation
├── temp/                          # Temporary files
├── .env                          # Environment configuration
├── index.js                      # Entry point
└── README.md                     # This file
```

## 🔐 Security

- ✅ **No hardcoded secrets** - All sensitive data in `.env`
- ✅ **Private keys secured** - Never logged or exposed
- ✅ **Environment validation** - Checks required variables
- ✅ **Temporary file cleanup** - No sensitive data left behind

## 🎯 MVP Features

### ✅ Completed
- Automatic Argent wallet generation
- STRK funding (0.1 STRK per wallet)
- Complete wallet deployment
- Database persistence
- Environment-based configuration
- Sepolia testnet integration

### 🔮 Next Steps
- Mainnet support
- Frontend integration
- LayerSwap API integration
- L1↔L2 bridge automation
- Paymaster integration

## 🛠️ Technical Details

### Dependencies
- `starknet`: Starknet.js library
- `dotenv`: Environment variable loading
- `sncast`: Starknet Foundry CLI (external)
- `starkli`: Starknet CLI (external)

### Wallet Creation Flow
1. Generate random keypair using Starknet.js
2. Use `starkli` to calculate correct Argent address
3. Fund address with STRK using `sncast`
4. Deploy wallet using `starkli account deploy`
5. Save complete wallet data to JSON database

## 🔗 Example Output

```bash
$ node index.js create alice

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🆕 Creating complete wallet for: alice
🔑 Generating keypair...
📐 Generating Argent account config with starkli...
✅ Starknet L2 Wallet Address: 0x063597c2ff6f08d298a627911f05510e3bcb2ede2693c9b92c09946c7eb46797
💸 Funding wallet with 0.1 STRK...
✅ STRK transfer TX: 0x0258dbe557fb46f9fbb9a8e54af8f7c8ca079106c961ed98d30e818a7cae0b2e
💰 Account balance: 0.1000 STRK
🚀 Deploying account using starkli account deploy...
✅ Account deployed via starkli! TX: 0x006cb97731018303616548b2f39f18dedc61fcec35c89f2b969d43fe38ab6255

🎉 WALLET CREATION COMPLETE!
   Status: DEPLOYED ✅
   🔗 DEPLOYED WALLET: https://sepolia.starkscan.co/contract/0x063597c2ff6f08d298a627911f05510e3bcb2ede2693c9b92c09946c7eb46797
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 📋 Development

### Testing
```bash
# Test wallet creation
node index.js create test_user_$(date +%s)

# Check database
node index.js list
```

### Debug Mode
Set `DEBUG=1` in `.env` for verbose logging.

## 🤝 Contributing

This is an MVP for research and development. Focus on:
- Security improvements
- Error handling
- Performance optimization
- Frontend integration preparation

---

## 🚨 **FINAL SECURITY REMINDER** 🚨

### **THIS MVP VIOLATES PRODUCTION SECURITY STANDARDS**

**🔴 Critical Issues:**
- ❌ Stores private keys in plaintext JSON
- ❌ No encryption for sensitive data  
- ❌ Custodial wallet architecture
- ❌ Single point of failure
- ❌ No proper key rotation
- ❌ Vulnerable to data breaches

**✅ Production Architecture Should:**
- Use account abstraction for gasless UX
- Generate wallets client-side only
- Never store private keys server-side
- Implement proper session management
- Use hardware security modules (HSM)
- Follow zero-knowledge principles

**⚠️ Testnet Only**: Currently configured for Sepolia testnet. **NEVER use on mainnet without complete security overhaul.**

**🎯 Remember**: This is a **learning tool** and **proof of concept** - not production-ready code.

*DISCLAIMER: I know that this may be doable just by using starknet-js w/o sncast/starkli, but I can't simply make v3 transaction's resource bounds work as expected.**
