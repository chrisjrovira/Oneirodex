/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
                                // List of supported platforms for WebRetro emulation
                                const supportedPlatforms = [
                                    'NES', 'SNES', 'N64', 'GB', 'GBA', 'GBC', 'NDS', 'VB',
                                    'PSX', 'SEGA_MD', 'SEGA_MS', 'SEGA_CD', 'SEGA_32X', 'SEGA_GG',
                                    'SEGA_SATURN', 'ATARI_7800', 'ATARI_5200', 'ATARI_2600',
                                    'LYNX', 'JAGUAR', 'WS', 'NGP', 'COLECO', 'VECTREX',
                                    'THREEDO', 'NEOGEO_CD', 'INTV', 'CHAF', 'O2EM',
                                ];
                                
                                // Function to get emulator core for the current platform
                                async function getEmulatorCore() {
                                    try {
                                        // Get the platform from the library
                                        const playNow = document.getElementById('play-now-button');
                                        const libraryUuid = playNow ? playNow.getAttribute('data-library-uuid') : '';
                                        const response = await fetch(`/api/library/${libraryUuid}`);
                                        const libraryData = await response.json();
                                        const platformKey = libraryData.platform || '';
                                        
                                        // Check if platform is supported
                                        if (!supportedPlatforms.includes(platformKey)) {
                                            // Hide the play button if platform is not supported
                                            console.log(`Platform '${platformKey}' is not supported by WebRetro`);
                                            const playButton = document.getElementById('play-now-button');
                                            if (playButton) {
                                                playButton.style.display = 'none';
                                            }
                                            return null;
                                        }
                                        
                                        // Get emulators for this platform (preferred core first when profiles set)
                                        const emulatorsResponse = await fetch(`/api/emulators/${platformKey}`);
                                        const emulatorsData = await emulatorsResponse.json();
                                        const preferred = emulatorsData.preferred;
                                        const emulators = emulatorsData.emulators || [];
                                        if (preferred) {
                                            console.log(`Using preferred emulator core '${preferred}' for platform '${platformKey}'`);
                                            return { core: preferred, platform: platformKey };
                                        }
                                        
                                        // Only return a valid emulator core if we have one
                                        if (emulators.length > 0) {
                                            console.log(`Using emulator core '${emulators[0]}' for platform '${platformKey}'`);
                                            return { core: emulators[0], platform: platformKey };
                                        } else {
                                            // No emulators available for this platform - hide play button
                                            console.log(`No emulators configured for platform '${platformKey}'`);
                                            const playButton = document.getElementById('play-now-button');
                                            if (playButton) {
                                                playButton.style.display = 'none';
                                            }
                                            return null;
                                        }
                                    } catch (error) {
                                        console.error('Error fetching emulator core:', error);
                                        // Hide play button on error
                                        const playButton = document.getElementById('play-now-button');
                                        if (playButton) {
                                            playButton.style.display = 'none';
                                        }
                                        return null;
                                    }
                                }

                                // Set up the Play Now button with the correct emulator core
                                document.addEventListener('DOMContentLoaded', async () => {
                                    const playButton = document.getElementById('play-now-button');
                                    if (!playButton) return;
                                    
                                    const playInfo = await getEmulatorCore();
                                    // Only set up the button if we have a valid emulator core
                                    if (playInfo && playInfo.core && playInfo.core !== 'auto') {
                                        const platformQ = playInfo.platform
                                            ? `&platform=${encodeURIComponent(playInfo.platform)}`
                                            : '';
                                        playButton.href = `/static/vendor/webretro/webretro.html?guid=${encodeURIComponent(playButton.getAttribute('data-game-uuid') || '')}&core=${playInfo.core}${platformQ}`;
                                        console.log(`Play button configured with WebRetro URL: ${playButton.href}`);
                                    } else {
                                        // Hide the button if no valid emulator core is available
                                        console.log('Play button hidden - no valid emulator core available');
                                        playButton.style.display = 'none';
                                    }
                                });
                                
