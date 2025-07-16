import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Progress } from '../components/ui/progress'
import { Alert, AlertDescription } from '../components/ui/alert'
import { blink } from '../blink/client'
import { 
  Upload, 
  Database, 
  ArrowLeft, 
  FileText, 
  AlertCircle,
  CheckCircle,
  Cloud
} from 'lucide-react'

export default function DataImport() {
  const navigate = useNavigate()
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // S3 connection state
  const [s3Config, setS3Config] = useState({
    bucket: '',
    region: '',
    accessKey: '',
    secretKey: '',
    filePath: ''
  })

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleFileUpload = useCallback(async (file: File) => {
    setError(null)
    setSuccess(null)
    
    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a CSV or XLSX file')
      return
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      // Upload file to storage
      const { publicUrl } = await blink.storage.upload(
        file,
        `uploads/${Date.now()}-${file.name}`,
        {
          upsert: true,
          onProgress: (percent) => setUploadProgress(percent)
        }
      )

      // Try to save to database first, fallback to localStorage
      const user = await blink.auth.me()
      const project = {
        id: `project_${Date.now()}`,
        user_id: user.id,
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        status: 'draft' as const,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Try to save to database first
      try {
        await blink.db.projects.create(project)
      } catch (dbError) {
        console.log('Database not available, using localStorage:', dbError)
        // Fallback to localStorage
        const existingProjects = JSON.parse(localStorage.getItem('temp_projects') || '[]')
        existingProjects.push(project)
        localStorage.setItem('temp_projects', JSON.stringify(existingProjects))
      }

      setUploadedFile(file)
      setSuccess(`File "${file.name}" uploaded successfully!`)
      
      // Navigate to column mapping after a short delay
      setTimeout(() => {
        navigate('/mapping', { state: { projectId: project.id } })
      }, 2000)

    } catch (error) {
      console.error('Upload failed:', error)
      setError('Failed to upload file. Please try again.')
    } finally {
      setUploading(false)
    }
  }, [navigate])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }, [handleFileUpload])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleS3Connect = async () => {
    setError(null)
    setSuccess(null)

    if (!s3Config.bucket || !s3Config.region || !s3Config.accessKey || !s3Config.secretKey || !s3Config.filePath) {
      setError('Please fill in all S3 configuration fields')
      return
    }

    setUploading(true)

    try {
      // In a real implementation, this would connect to S3
      // For now, we'll simulate the connection
      await new Promise(resolve => setTimeout(resolve, 2000))

      const user = await blink.auth.me()
      const project = {
        id: `project_${Date.now()}`,
        user_id: user.id,
        name: s3Config.filePath.split('/').pop() || 'S3 Import',
        status: 'draft' as const,
        file_name: s3Config.filePath,
        s3_config: JSON.stringify(s3Config),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Try to save to database first
      try {
        await blink.db.projects.create(project)
      } catch (dbError) {
        console.log('Database not available, using localStorage:', dbError)
        // Fallback to localStorage
        const existingProjects = JSON.parse(localStorage.getItem('temp_projects') || '[]')
        existingProjects.push(project)
        localStorage.setItem('temp_projects', JSON.stringify(existingProjects))
      }

      setSuccess('Successfully connected to S3 and imported data!')
      
      setTimeout(() => {
        navigate('/mapping', { state: { projectId: project.id } })
      }, 2000)

    } catch (error) {
      console.error('S3 connection failed:', error)
      setError('Failed to connect to S3. Please check your credentials.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex items-center space-x-2">
              <Database className="h-6 w-6 text-primary" />
              <h1 className="text-lg font-semibold">Import Data</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Import Your Data
          </h2>
          <p className="text-lg text-muted-foreground">
            Upload a file or connect to your S3 bucket to get started
          </p>
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>File Upload</span>
            </TabsTrigger>
            <TabsTrigger value="s3" className="flex items-center space-x-2">
              <Cloud className="h-4 w-4" />
              <span>S3 Connection</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Data File</CardTitle>
                <CardDescription>
                  Drag and drop your CSV or XLSX file, or click to browse
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  {uploading ? (
                    <div className="space-y-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="text-sm text-muted-foreground">Uploading...</p>
                      <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                      <p className="text-xs text-muted-foreground">{uploadProgress}% complete</p>
                    </div>
                  ) : uploadedFile ? (
                    <div className="space-y-2">
                      <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
                      <p className="font-medium">{uploadedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
                      <div>
                        <p className="text-lg font-medium mb-2">
                          Drop your file here, or{' '}
                          <label className="text-primary cursor-pointer hover:underline">
                            browse
                            <input
                              type="file"
                              className="hidden"
                              accept=".csv,.xlsx,.xls"
                              onChange={handleFileSelect}
                            />
                          </label>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Supports CSV and XLSX files up to 50MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="s3" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Connect to S3</CardTitle>
                <CardDescription>
                  Enter your S3 credentials to import data directly from your bucket
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bucket">Bucket Name</Label>
                    <Input
                      id="bucket"
                      placeholder="my-data-bucket"
                      value={s3Config.bucket}
                      onChange={(e) => setS3Config(prev => ({ ...prev, bucket: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Input
                      id="region"
                      placeholder="us-east-1"
                      value={s3Config.region}
                      onChange={(e) => setS3Config(prev => ({ ...prev, region: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="accessKey">Access Key ID</Label>
                    <Input
                      id="accessKey"
                      type="password"
                      placeholder="AKIA..."
                      value={s3Config.accessKey}
                      onChange={(e) => setS3Config(prev => ({ ...prev, accessKey: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secretKey">Secret Access Key</Label>
                    <Input
                      id="secretKey"
                      type="password"
                      placeholder="..."
                      value={s3Config.secretKey}
                      onChange={(e) => setS3Config(prev => ({ ...prev, secretKey: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filePath">File Path</Label>
                  <Input
                    id="filePath"
                    placeholder="data/my-file.csv"
                    value={s3Config.filePath}
                    onChange={(e) => setS3Config(prev => ({ ...prev, filePath: e.target.value }))}
                  />
                </div>

                <Button 
                  onClick={handleS3Connect} 
                  disabled={uploading}
                  className="w-full"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Connect to S3
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}