/* Tweaks panel */
const { useEffect } = React;

function App(){
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS || {
    theme: 'dark', accent: 'amber', density: 'comfortable',
    heroVariant: 'terminal', projectStyle: 'deck', showGrid: true, fontPair: 'geist-instrument'
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', t.theme);
    document.documentElement.setAttribute('data-accent', t.accent);
    document.documentElement.setAttribute('data-density', t.density);
    document.documentElement.setAttribute('data-font', t.fontPair);
    document.body.setAttribute('data-grid', t.showGrid ? 'true' : 'false');
  }, [t.theme, t.accent, t.density, t.fontPair, t.showGrid]);

  return (
    <TweaksPanel title="Tweaks · console.config">
      <TweakSection title="Theme">
        <TweakRadio label="Mode" value={t.theme} options={[['dark','Dark'],['light','Light']]} onChange={v => setTweak('theme', v)} />
        <TweakRadio label="Accent" value={t.accent} options={[['emerald','Emerald'],['indigo','Indigo'],['amber','Amber'],['green','Green'],['cyan','Cyan'],['red','Red']]} onChange={v => setTweak('accent', v)} />
      </TweakSection>

      <TweakSection title="Layout">
        <TweakRadio label="Density" value={t.density} options={[['compact','Tight'],['comfortable','Default'],['airy','Airy']]} onChange={v => setTweak('density', v)} />
        <TweakToggle label="Background grid" value={t.showGrid} onChange={v => setTweak('showGrid', v)} />
      </TweakSection>

      <TweakSection title="Type">
        <TweakSelect label="Font pair" value={t.fontPair} options={[
          ['geist-instrument','Geist Mono + Instrument Serif'],
          ['mono-only','Mono only (Geist)'],
          ['serif-display','Serif display (Instrument)'],
          ['inter-only','Inter only (sans)']
        ]} onChange={v => setTweak('fontPair', v)} />
      </TweakSection>
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('tweaks-root')).render(<App />);
