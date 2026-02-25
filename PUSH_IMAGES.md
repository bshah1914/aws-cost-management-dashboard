# Push Docker Images to GitHub Container Registry

## Prerequisites

1. **Create GitHub Personal Access Token (if you don't have one):**
   - Go to https://github.com/settings/tokens
   - Click "Generate new token" → "Generate new token (classic)"
   - Token name: `ghcr-push-token`
   - Expiration: 90 days
   - **Scopes:** Check `write:packages`
   - Copy the token

2. **Images already built and tagged:**
   - `ghcr.io/bshah1914/aws-cost-dashboard-backend:latest`
   - `ghcr.io/bshah1914/aws-cost-dashboard-frontend:latest`

## Push Images

```bash
# Set your GitHub token
export CR_TOKEN="your_github_token_here"

# Login to GitHub Container Registry
echo $CR_TOKEN | sudo docker login ghcr.io -u bshah1914 --password-stdin

# Push backend image
sudo docker push ghcr.io/bshah1914/aws-cost-dashboard-backend:latest

# Push frontend image
sudo docker push ghcr.io/bshah1914/aws-cost-dashboard-frontend:latest

# Verify images in GHCR
echo "Images pushed successfully!"
```

## After Pushing

Once images are pushed, you have the image URLs ready for:
- Terraform variables (`backend_image`, `frontend_image`)
- Jenkins pipeline deployments
- Kubernetes manifests (if needed)

**Image URLs:**
- Backend: `ghcr.io/bshah1914/aws-cost-dashboard-backend:latest`
- Frontend: `ghcr.io/bshah1914/aws-cost-dashboard-frontend:latest`
