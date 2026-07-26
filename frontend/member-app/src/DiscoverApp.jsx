import { GameGrid } from './components/GameGrid'

export function DiscoverApp({ sections, isAdmin = false, shellConfig = {} } = {}) {
  return sections
    .filter((section) => section.games.length > 0)
    .map((section) => (
      <section key={section.identifier} data-discover-section={section.identifier}>
        <h2 className={`discovery-${section.identifier.replaceAll('_', '-')}-label`}>
          {section.title}
        </h2>
        <GameGrid
          games={section.games}
          isAdmin={isAdmin}
          showPlayStatus={Boolean(shellConfig.showPlayStatus)}
          enableDeleteOnDisk={Boolean(shellConfig.enableDeleteOnDisk)}
          discordConfigured={Boolean(shellConfig.discordConfigured)}
          discordManualTrigger={Boolean(shellConfig.discordManualTrigger)}
        />
      </section>
    ))
}
