export default function Home() {
  return (
    <main className="terrain-page">
      <iframe
        className="terrain-frame"
        src="/terrain/index.html"
        title="桂林扩展 DEM 完整范围三维地形"
        loading="eager"
        allowFullScreen
      />
    </main>
  );
}
