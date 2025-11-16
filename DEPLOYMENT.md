# Deployment Guide: Soklin

## Overview
Soklin is a blockchain security platform with a frontend (React/Vite) and backend (Node.js/Express) that need to be deployed separately.

---

## Frontend Deployment (Vercel)

### Prerequisites
- Vercel account
- GitHub account connected to Vercel
- Your GitHub repository pushed with the code

### Steps

1. **Prepare the frontend for deployment**
   ```bash
   cd frontend
   npm install
   npm run build
   ```
   This creates a `dist` folder with the production build.

2. **Deploy to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Select "Import Git Repository"
   - Enter your repository URL: `https://github.com/ArielSltty/Soklin`
   - Select the `frontend` directory
   - Click "Deploy"

3. **Environment Variables Setup**
   In Vercel dashboard, go to your project settings and add these environment variables:
   - `VITE_API_BASE`: Your backend API URL (e.g., `https://your-backend-app.railway.app/api`)
   - `VITE_WS_URL`: Your backend WebSocket URL (e.g., `wss://your-backend-app.railway.app`)

4. **Custom Domain (Optional)**
   - In Vercel dashboard, go to your project
   - Go to "Settings" > "Domains"
   - Add your custom domain or use the default `.vercel.app` domain

---

## Backend Deployment (Railway)

### Prerequisites
- Railway account
- GitHub account connected to Railway
- Somnia Testnet account with RPC access
- Private key for wallet operations

### Steps

1. **Get your Somnia credentials ready**:
   - Somnia RPC URL (e.g., `https://dream-rpc.somnia.network`)
   - Private key for wallet operations
   - Deployed contract address (from `smart-contract/deployment-info.json`)

2. **Deploy to Railway**
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `ArielSltty/Soklin` repository
   - Select the `backend` directory
   - Railway will automatically detect the Node.js project

3. **Environment Variables Setup**
   In Railway dashboard, go to your project variables and add these environment variables:
   
   | Key | Value | Required |
   |-----|-------|----------|
   | `SOMNIA_RPC_URL` | Your Somnia RPC URL | ✓ |
   | `SOMNIA_CHAIN_ID` | `50312` | ✓ |
   | `PRIVATE_KEY` | Your wallet private key | ✓ |
   | `CONTRACT_ADDRESS` | Your deployed contract address | ✓ |
   | `MODEL_PATH` | `../ml-models/wallet_fraud_model.onnx` | |
   | `SCALER_PATH` | `../ml-models/scaler.pkl` | |
   | `FEATURES_PATH` | `../ml-models/model_features.json` | |
   | `BLACKLIST_PATH` | `../ml-models/blacklist.json` | |
   | `NODE_ENV` | `production` | |
   | `PORT` | `8000` | |

4. **Deploy the project**
   - Click "Deploy Now" or wait for automatic deployment
   - Check the logs to confirm successful deployment

---

## Configuration After Deployment

### 1. Update Vercel Environment Variables
After both deployments are complete:
- Set `VITE_API_BASE` in Vercel to your Railway backend URL (e.g., `https://your-backend-production-xxxx.railway.app/api`)
- Set `VITE_WS_URL` in Vercel to your Railway backend URL (e.g., `wss://your-backend-production-xxxx.railway.app`)

### 2. Verify the setup
- Visit your frontend URL (from Vercel)
- Check that the application loads properly
- Verify that WebSocket connections work
- Test the wallet monitoring functionality

---

## Troubleshooting

### Frontend Issues
- If the frontend shows "Failed to load" errors, ensure your backend URL in environment variables is correct
- Check browser developer console for specific error messages

### Backend Issues
- Check Railway logs for any startup errors
- Ensure all environment variables are properly set
- Verify that your Somnia RPC connection is working

### WebSocket Issues
- Ensure the WebSocket URL in Vercel environment variables matches your Railway deployment URL
- Check that your backend is properly handling WebSocket connections

---

## Production Notes

- Keep your private keys and sensitive data secure
- Monitor your deployments for any issues
- Consider setting up custom domains for a more professional appearance
- Set up monitoring and alerts if needed

---

## Support

For any deployment issues, check the repository issues or contact the development team.