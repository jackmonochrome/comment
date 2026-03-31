import { EditableComment } from './components/EditableComment';

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-8 text-zinc-500">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl items-center justify-center">
        <EditableComment />
      </div>
    </div>
  );
}
