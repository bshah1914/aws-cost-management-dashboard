pipeline {
    agent any

    environment {
        REGISTRY = 'ghcr.io'
        IMAGE_PREFIX = 'bshah1914'
        BACKEND_IMAGE = "${REGISTRY}/${IMAGE_PREFIX}/aws-cost-dashboard-backend"
        FRONTEND_IMAGE = "${REGISTRY}/${IMAGE_PREFIX}/aws-cost-dashboard-frontend"
        REGISTRY_CREDENTIALS = credentials('github-container-registry')
        KUBECONFIG = credentials('kubeconfig-aws-cost-management')
        GIT_REPO = 'https://github.com/bshah1914/aws-cost-management-dashboard.git'
    }

    parameters {
        choice(
            name: 'DEPLOY_ENV',
            choices: ['staging', 'production'],
            description: 'Choose deployment environment'
        )
    }

    stages {
        stage('Checkout') {
            steps {
                script {
                    echo "Cloning repository..."
                    checkout([
                        $class: 'GitSCM',
                        branches: [[name: '*/main']],
                        userRemoteConfigs: [[url: "${GIT_REPO}"]]
                    ])
                }
            }
        }

        stage('Build Backend Image') {
            steps {
                script {
                    echo "Building backend Docker image..."
                    sh '''
                        docker build -t ${BACKEND_IMAGE}:${BUILD_NUMBER} \
                                   -t ${BACKEND_IMAGE}:latest \
                                   -f backend/Dockerfile \
                                   backend/
                    '''
                }
            }
        }

        stage('Build Frontend Image') {
            steps {
                script {
                    echo "Building frontend Docker image..."
                    sh '''
                        docker build -t ${FRONTEND_IMAGE}:${BUILD_NUMBER} \
                                   -t ${FRONTEND_IMAGE}:latest \
                                   -f frontend/Dockerfile \
                                   frontend/
                    '''
                }
            }
        }

        stage('Push to Registry') {
            steps {
                script {
                    echo "Logging in to GitHub Container Registry..."
                    sh '''
                        echo $REGISTRY_CREDENTIALS_PSW | docker login ${REGISTRY} \
                            -u $REGISTRY_CREDENTIALS_USR \
                            --password-stdin
                    '''

                    echo "Pushing backend image..."
                    sh '''
                        docker push ${BACKEND_IMAGE}:${BUILD_NUMBER}
                        docker push ${BACKEND_IMAGE}:latest
                    '''

                    echo "Pushing frontend image..."
                    sh '''
                        docker push ${FRONTEND_IMAGE}:${BUILD_NUMBER}
                        docker push ${FRONTEND_IMAGE}:latest
                    '''

                    sh 'docker logout ${REGISTRY}'
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                script {
                    echo "Deploying to ${DEPLOY_ENV} environment..."
                    sh '''
                        export NAMESPACE="${DEPLOY_ENV}"
                        export BACKEND_IMAGE="${BACKEND_IMAGE}:${BUILD_NUMBER}"
                        export FRONTEND_IMAGE="${FRONTEND_IMAGE}:${BUILD_NUMBER}"
                        
                        # Create namespace if not exists
                        kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
                        
                        # Apply configs
                        envsubst < k8s/namespace.yaml | kubectl apply -f -
                        envsubst < k8s/configmap.yaml | kubectl apply -f -
                        envsubst < k8s/secrets.yaml | kubectl apply -f -
                        
                        # Apply deployments and services for specific environment
                        envsubst < k8s/${DEPLOY_ENV}/backend-deployment.yaml | kubectl apply -f -
                        envsubst < k8s/${DEPLOY_ENV}/backend-service.yaml | kubectl apply -f -
                        envsubst < k8s/${DEPLOY_ENV}/frontend-deployment.yaml | kubectl apply -f -
                        envsubst < k8s/${DEPLOY_ENV}/frontend-service.yaml | kubectl apply -f -
                        
                        # Wait for rollout
                        kubectl rollout status deployment/backend-dashboard -n ${NAMESPACE} --timeout=5m
                        kubectl rollout status deployment/frontend-dashboard -n ${NAMESPACE} --timeout=5m
                    '''
                }
            }
        }

        stage('Verify Deployment') {
            steps {
                script {
                    echo "Verifying deployment in ${DEPLOY_ENV}..."
                    sh '''
                        export NAMESPACE="${DEPLOY_ENV}"
                        
                        echo "Pods status:"
                        kubectl get pods -n ${NAMESPACE}
                        
                        echo "\nServices:"
                        kubectl get svc -n ${NAMESPACE}
                        
                        echo "\nDeployments:"
                        kubectl get deployments -n ${NAMESPACE}
                    '''
                }
            }
        }
    }

    post {
        always {
            echo "Pipeline execution completed for ${DEPLOY_ENV}"
        }
        success {
            echo "✓ Successfully deployed to ${DEPLOY_ENV}"
        }
        failure {
            echo "✗ Deployment failed. Check logs above."
        }
    }
}
