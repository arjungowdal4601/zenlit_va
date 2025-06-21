import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Welcome to Zenlit
        </h1>
        <p className="text-gray-600 mb-6">
          Your social networking platform
        </p>
        <Button className="w-full">
          Get Started
        </Button>
      </div>
    </main>
  )
}