#!/bin/bash

# Jenkins Setup Script
# This script helps install and configure Jenkins

set -e

echo "Installing Jenkins on Ubuntu/Debian..."

# Update system
echo "Updating system packages..."
sudo apt-get update
sudo apt-get install -y openjdk-11-jdk

# Add Jenkins repository
echo "Adding Jenkins repository..."
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io.key | sudo tee \
  /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/ | sudo tee \
  /etc/apt/sources.list.d/jenkins.list > /dev/null

# Install Jenkins
echo "Installing Jenkins..."
sudo apt-get update
sudo apt-get install -y jenkins

# Start Jenkins
echo "Starting Jenkins..."
sudo systemctl start jenkins
sudo systemctl enable jenkins

# Install Docker (required for Jenkins to build images)
echo "Installing Docker..."
sudo apt-get install -y docker.io
sudo usermod -aG docker jenkins
sudo usermod -aG docker $USER

# Install kubectl
echo "Installing kubectl..."
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
rm kubectl

echo ""
echo "✓ Jenkins installation complete!"
echo ""
echo "Next steps:"
echo "1. Access Jenkins at http://localhost:8080"
echo "2. Get initial admin password:"
echo "   sudo cat /var/lib/jenkins/secrets/initialAdminPassword"
echo "3. Complete setup wizard and install suggested plugins"
echo "4. Add GitHub Container Registry credentials:"
echo "   - Jenkins > Manage Jenkins > Manage Credentials"
echo "   - Create credential type 'Username with password'"
echo "   - Username: bshah1914"
echo "   - Password: <your-github-token>"
echo "   - ID: github-container-registry"
echo "5. Add kubeconfig secret:"
echo "   - Create credential type 'Secret file'"
echo "   - Upload your kubeconfig file"
echo "   - ID: kubeconfig-aws-cost-management"
echo "6. Create new Pipeline job and point to your repo"
