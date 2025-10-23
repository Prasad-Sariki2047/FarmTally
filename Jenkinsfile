pipeline {
    agent any
    
    environment {
        // Server Configuration
        TARGET_SERVER = '147.93.153.247'
        DOCKER_REGISTRY = 'localhost:5000'  // Shared registry
        IMAGE_NAME = 'farmtally/user-service'
        GIT_REPO = 'https://github.com/Prasad-Sariki2047/FarmTally.git'
        
        // Credentials (stored in Jenkins credentials)
        DOCKER_REGISTRY_CREDENTIALS = credentials('docker-registry-credentials')
        SERVER_SSH_CREDENTIALS = credentials('server-ssh-credentials')
        
        // Build Configuration
        NODE_VERSION = '18'
        DOCKER_BUILDKIT = '1'
    }
    
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
    }
    
    triggers {
        // Trigger build on SCM changes
        pollSCM('H/5 * * * *')
        
        // Trigger build on webhook
        githubPush()
    }
    
    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out FarmTally source code...'
                git branch: 'main', 
                    url: 'https://github.com/Prasad-Sariki2047/FarmTally.git',
                    credentialsId: 'github-credentials'
                
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                    env.BUILD_TAG = "farmtally-${env.BUILD_NUMBER}-${env.GIT_COMMIT_SHORT}"
                }
            }
        }
        
        stage('Environment Setup') {
            steps {
                echo 'Setting up build environment...'
                
                // Install Node.js dependencies
                sh '''
                    node --version
                    npm --version
                    npm ci --only=production
                '''
            }
        }
        
        stage('Code Quality') {
            parallel {
                stage('Lint') {
                    steps {
                        echo 'Running ESLint...'
                        sh 'npm run lint'
                    }
                    post {
                        always {
                            publishHTML([
                                allowMissing: false,
                                alwaysLinkToLastBuild: true,
                                keepAll: true,
                                reportDir: 'reports',
                                reportFiles: 'eslint-report.html',
                                reportName: 'ESLint Report'
                            ])
                        }
                    }
                }
                
                stage('Security Scan') {
                    steps {
                        echo 'Running security audit...'
                        sh 'npm audit --audit-level=moderate'
                        
                        // Optional: Run additional security tools
                        script {
                            try {
                                sh 'npx snyk test --severity-threshold=high'
                            } catch (Exception e) {
                                echo "Security scan completed with warnings: ${e.getMessage()}"
                            }
                        }
                    }
                }
            }
        }
        
        stage('Test') {
            steps {
                echo 'Running tests...'
                sh 'npm test -- --coverage --ci --watchAll=false'
            }
            post {
                always {
                    // Publish test results
                    publishTestResults testResultsPattern: 'coverage/lcov.info'
                    
                    // Publish coverage report
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'coverage/lcov-report',
                        reportFiles: 'index.html',
                        reportName: 'Coverage Report'
                    ])
                }
            }
        }
        
        stage('Build') {
            steps {
                echo 'Building TypeScript application...'
                sh 'npm run build'
                
                echo 'Building Docker image...'
                script {
                    def imageTag = "${env.DOCKER_REGISTRY}/${env.IMAGE_NAME}:${env.BUILD_TAG}"
                    def latestTag = "${env.DOCKER_REGISTRY}/${env.IMAGE_NAME}:latest"
                    
                    // Build Docker image
                    sh """
                        docker build \\
                            --build-arg BUILD_NUMBER=${env.BUILD_NUMBER} \\
                            --build-arg GIT_COMMIT=${env.GIT_COMMIT} \\
                            --tag ${imageTag} \\
                            --tag ${latestTag} \\
                            .
                    """
                    
                    env.DOCKER_IMAGE_TAG = imageTag
                    env.DOCKER_IMAGE_LATEST = latestTag
                }
            }
        }
        
        stage('Push to Registry') {
            steps {
                echo 'Pushing Docker image to registry...'
                script {
                    docker.withRegistry("http://${env.DOCKER_REGISTRY}", env.DOCKER_REGISTRY_CREDENTIALS) {
                        sh "docker push ${env.DOCKER_IMAGE_TAG}"
                        sh "docker push ${env.DOCKER_IMAGE_LATEST}"
                    }
                }
            }
        }
        
        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                echo 'Deploying to production server...'
                
                script {
                    sshagent([env.SERVER_SSH_CREDENTIALS]) {
                        sh """
                            ssh -o StrictHostKeyChecking=no root@${env.TARGET_SERVER} '
                                cd /opt/farmtally &&
                                
                                # Pull latest code from GitHub
                                git pull origin main &&
                                
                                # Pull latest images
                                docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull &&
                                
                                # Deploy with zero-downtime
                                docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d &&
                                
                                # Wait for health check
                                sleep 30 &&
                                
                                # Verify deployment (FarmTally uses port 3001)
                                curl -f http://localhost:3001/health || exit 1 &&
                                
                                echo "FarmTally deployment completed successfully"
                            '
                        """
                    }
                }
            }
        }
        
        stage('Post-Deploy Tests') {
            when {
                branch 'main'
            }
            steps {
                echo 'Running post-deployment tests...'
                
                script {
                    // Health check (FarmTally port 3001)
                    sh """
                        curl -f http://${env.TARGET_SERVER}:3001/health
                    """
                    
                    // API endpoint tests
                    sh """
                        curl -f http://${env.TARGET_SERVER}:3001/api/auth/health
                    """
                    
                    // Performance test (basic)
                    sh """
                        curl -w "@curl-format.txt" -o /dev/null -s https://${env.TARGET_SERVER}/health
                    """
                }
            }
        }
    }
    
    post {
        always {
            echo 'Cleaning up...'
            
            // Clean up Docker images
            sh '''
                docker image prune -f
                docker system prune -f --volumes
            '''
            
            // Archive artifacts
            archiveArtifacts artifacts: 'dist/**/*', allowEmptyArchive: true
            
            // Clean workspace
            cleanWs()
        }
        
        success {
            echo 'Pipeline completed successfully!'
            
            // Send success notification
            script {
                if (env.BRANCH_NAME == 'main') {
                    slackSend(
                        channel: '#deployments',
                        color: 'good',
                        message: """
                            ✅ FarmTally deployment successful!
                            Branch: ${env.BRANCH_NAME}
                            Build: ${env.BUILD_NUMBER}
                            Commit: ${env.GIT_COMMIT_SHORT}
                            Server: ${env.TARGET_SERVER}
                        """
                    )
                }
            }
        }
        
        failure {
            echo 'Pipeline failed!'
            
            // Send failure notification
            slackSend(
                channel: '#deployments',
                color: 'danger',
                message: """
                    ❌ FarmTally deployment failed!
                    Branch: ${env.BRANCH_NAME}
                    Build: ${env.BUILD_NUMBER}
                    Commit: ${env.GIT_COMMIT_SHORT}
                    Check: ${env.BUILD_URL}
                """
            )
            
            // Email notification for main branch failures
            script {
                if (env.BRANCH_NAME == 'main') {
                    emailext(
                        subject: "FarmTally Production Deployment Failed - Build ${env.BUILD_NUMBER}",
                        body: """
                            The FarmTally production deployment has failed.
                            
                            Build Number: ${env.BUILD_NUMBER}
                            Branch: ${env.BRANCH_NAME}
                            Commit: ${env.GIT_COMMIT}
                            
                            Please check the build logs: ${env.BUILD_URL}
                        """,
                        to: 'admin@farmtally.com,ops@farmtally.com'
                    )
                }
            }
        }
        
        unstable {
            echo 'Pipeline completed with warnings'
            
            slackSend(
                channel: '#deployments',
                color: 'warning',
                message: """
                    ⚠️ FarmTally deployment completed with warnings
                    Branch: ${env.BRANCH_NAME}
                    Build: ${env.BUILD_NUMBER}
                    Check: ${env.BUILD_URL}
                """
            )
        }
    }
}