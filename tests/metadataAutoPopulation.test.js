/**
 * Comprehensive Test Suite for Metadata Auto-Population
 * Tests intelligent bookmark metadata generation including titles, descriptions, and tags
 */

// Mock the metadata generation functions for testing
const MetadataGenerator = {
  generateBookmarkMetadata: (filepath, mediaTitle, timestamp, userTitle, userDescription, userTags) => {
    // Extract filename and extension for analysis
    const filename = filepath.split('/').pop() || 'unknown';
    const fileExtension = filename.split('.').pop()?.toLowerCase() || '';
    const filenameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    
    // Generate intelligent title
    let autoTitle = userTitle;
    if (!autoTitle) {
      // Try to extract meaningful title from media title or filename
      if (mediaTitle && mediaTitle !== "Unknown Media" && !mediaTitle.includes(filename)) {
        autoTitle = `${mediaTitle} - ${MetadataGenerator.formatTime(timestamp)}`;
      } else {
        // Clean up filename for better title
        const cleanTitle = filenameWithoutExt
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase())
          .trim();
        autoTitle = `${cleanTitle} - ${MetadataGenerator.formatTime(timestamp)}`;
      }
    }

    // Generate intelligent description
    let autoDescription = userDescription;
    if (!autoDescription) {
      const fileType = MetadataGenerator.getMediaType(fileExtension);
      const timeOfDay = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const date = new Date().toLocaleDateString();
      
      autoDescription = `${fileType} bookmark created at ${timeOfDay} on ${date}`;
      
      // Add context based on timestamp
      if (timestamp < 300) { // First 5 minutes
        autoDescription += " (Opening scene)";
      } else if (timestamp > 0) {
        const minutes = Math.floor(timestamp / 60);
        autoDescription += ` (${minutes} minutes in)`;
      }
    }

    // Generate intelligent tags
    let autoTags = userTags || [];
    if (!userTags || userTags.length === 0) {
      autoTags = MetadataGenerator.generateAutoTags(filepath, fileExtension, mediaTitle, timestamp);
    }

    return {
      title: autoTitle,
      description: autoDescription,
      tags: autoTags
    };
  },

  getMediaType: (extension) => {
    const videoExtensions = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'];
    const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma'];
    
    if (videoExtensions.includes(extension)) {
      return 'Video';
    } else if (audioExtensions.includes(extension)) {
      return 'Audio';
    }
    return 'Media';
  },

  generateAutoTags: (filepath, extension, mediaTitle, timestamp) => {
    const tags = [];
    const pathLower = filepath.toLowerCase();
    const titleLower = mediaTitle.toLowerCase();
    
    // Media type tags
    const videoExtensions = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'];
    const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma'];
    
    if (videoExtensions.includes(extension)) {
      tags.push('video');
    } else if (audioExtensions.includes(extension)) {
      tags.push('audio');
    }

    // Content type detection from path
    if (pathLower.includes('movie') || pathLower.includes('film')) {
      tags.push('movie');
    }
    if (pathLower.includes('tv') || pathLower.includes('series') || pathLower.includes('episode')) {
      tags.push('tv-show');
    }
    if (pathLower.includes('documentary') || pathLower.includes('doc')) {
      tags.push('documentary');
    }
    if (pathLower.includes('music') || pathLower.includes('song') || pathLower.includes('album')) {
      tags.push('music');
    }
    if (pathLower.includes('tutorial') || pathLower.includes('training') || pathLower.includes('course')) {
      tags.push('educational');
    }
    if (pathLower.includes('work') || pathLower.includes('meeting') || pathLower.includes('presentation')) {
      tags.push('work');
    }

    // Genre detection from title and path
    const genreKeywords = {
      'action': ['action', 'fight', 'battle', 'war', 'combat'],
      'comedy': ['comedy', 'funny', 'humor', 'laugh', 'comic'],
      'drama': ['drama', 'dramatic', 'emotional'],
      'horror': ['horror', 'scary', 'fear', 'terror', 'zombie'],
      'sci-fi': ['sci-fi', 'science fiction', 'space', 'alien', 'future'],
      'thriller': ['thriller', 'suspense', 'mystery', 'crime'],
      'romance': ['romance', 'love', 'romantic', 'dating'],
      'adventure': ['adventure', 'quest', 'journey', 'explore'],
      'fantasy': ['fantasy', 'magic', 'wizard', 'dragon', 'medieval'],
      'animation': ['animation', 'animated', 'cartoon', 'anime']
    };

    for (const [genre, keywords] of Object.entries(genreKeywords)) {
      if (keywords.some(keyword => titleLower.includes(keyword) || pathLower.includes(keyword))) {
        tags.push(genre);
      }
    }

    // Temporal tags based on timestamp
    if (timestamp < 300) { // First 5 minutes
      tags.push('opening');
    } else if (timestamp < 600) { // First 10 minutes
      tags.push('beginning');
    }

    // Quality/resolution detection from filename
    if (pathLower.includes('4k') || pathLower.includes('2160p')) {
      tags.push('4k');
    } else if (pathLower.includes('1080p') || pathLower.includes('hd')) {
      tags.push('hd');
    } else if (pathLower.includes('720p')) {
      tags.push('720p');
    }

    // Language detection
    if (pathLower.includes('english') || pathLower.includes('en')) {
      tags.push('english');
    }
    if (pathLower.includes('subtitle') || pathLower.includes('sub')) {
      tags.push('subtitled');
    }

    // Remove duplicates and limit to reasonable number
    return [...new Set(tags)].slice(0, 5);
  },

  formatTime: (seconds) => {
    const date = new Date(0);
    date.setSeconds(seconds);
    return date.toISOString().substr(11, 8);
  }
};

// Test datasets for various scenarios
const createMetadataTestDatasets = () => {
  return {
    movieScenarios: [
      {
        filepath: '/Users/movies/action/john_wick_2014_1080p.mp4',
        mediaTitle: 'John Wick',
        timestamp: 120,
        expected: {
          titleContains: 'John Wick',
          descriptionContains: 'Video bookmark',
          tags: ['video', 'movie', 'action', 'hd']
        }
      },
      {
        filepath: '/media/films/comedy/the_grand_budapest_hotel.mkv',
        mediaTitle: 'The Grand Budapest Hotel',
        timestamp: 60,
        expected: {
          titleContains: 'The Grand Budapest Hotel',
          descriptionContains: 'Opening scene',
          tags: ['video', 'movie', 'comedy', 'opening']
        }
      }
    ],

    tvShowScenarios: [
      {
        filepath: '/tv/series/breaking_bad/s01e01.mp4',
        mediaTitle: 'Breaking Bad S01E01',
        timestamp: 1800,
        expected: {
          titleContains: 'Breaking Bad',
          descriptionContains: '30 minutes in',
          tags: ['video', 'tv-show']
        }
      }
    ],

    documentaryScenarios: [
      {
        filepath: '/docs/nature/planet_earth_4k.mp4',
        mediaTitle: 'Planet Earth',
        timestamp: 300,
        expected: {
          titleContains: 'Planet Earth',
          descriptionContains: '5 minutes in',
          tags: ['video', 'documentary', '4k']
        }
      }
    ],

    musicScenarios: [
      {
        filepath: '/music/albums/pink_floyd/dark_side_of_the_moon.mp3',
        mediaTitle: 'Money - Pink Floyd',
        timestamp: 45,
        expected: {
          titleContains: 'Money - Pink Floyd',
          descriptionContains: 'Audio bookmark',
          tags: ['audio', 'music']
        }
      }
    ],

    workScenarios: [
      {
        filepath: '/work/meetings/quarterly_review_2024.mp4',
        mediaTitle: 'Q4 Review Meeting',
        timestamp: 600,
        expected: {
          titleContains: 'Q4 Review Meeting',
          descriptionContains: '10 minutes in',
          tags: ['video', 'work']
        }
      },
      {
        filepath: '/training/courses/javascript_tutorial_part1.mp4',
        mediaTitle: 'JavaScript Fundamentals',
        timestamp: 900,
        expected: {
          titleContains: 'JavaScript Fundamentals',
          descriptionContains: '15 minutes in',
          tags: ['video', 'educational']
        }
      }
    ],

    edgeCases: [
      {
        filepath: '/unknown/weird-file_name.xyz',
        mediaTitle: 'Unknown Media',
        timestamp: 0,
        expected: {
          titleContains: 'Weird File Name',
          descriptionContains: 'Media bookmark',
          tags: []
        }
      },
      {
        filepath: '/movies/action_comedy_thriller_movie.mp4',
        mediaTitle: 'Multi Genre Film',
        timestamp: 7200,
        expected: {
          titleContains: 'Multi Genre Film',
          descriptionContains: '120 minutes in',
          tags: ['video', 'movie', 'action', 'comedy', 'thriller']
        }
      }
    ]
  };
};

// Test runner utilities
const runTest = (description, testFn) => {
  try {
    testFn();
    console.log(`✅ PASS: ${description}`);
    return true;
  } catch (error) {
    console.error(`❌ FAIL: ${description}`);
    console.error(`   Error: ${error.message}`);
    return false;
  }
};

const assertEqual = (actual, expected, message = '') => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`);
  }
};

const assertTrue = (condition, message = '') => {
  if (!condition) {
    throw new Error(message || 'Expected condition to be true');
  }
};

const assertContains = (text, substring, message = '') => {
  if (!text || !text.includes(substring)) {
    throw new Error(`${message}\n  Expected "${text}" to contain "${substring}"`);
  }
};

const assertArrayContains = (array, item, message = '') => {
  if (!Array.isArray(array) || !array.includes(item)) {
    throw new Error(`${message}\n  Expected array to contain: ${item}\n  Actual array: ${JSON.stringify(array)}`);
  }
};

// Main test suite
const runMetadataTests = () => {
  console.log('🎬 Starting Comprehensive Metadata Auto-Population Tests\n');
  
  const datasets = createMetadataTestDatasets();
  let passCount = 0;
  let totalTests = 0;

  // Title Generation Tests
  console.log('📝 Title Generation Tests');

  totalTests++;
  passCount += runTest('Generate title from media title', () => {
    const result = MetadataGenerator.generateBookmarkMetadata(
      '/movies/action.mp4',
      'John Wick',
      120,
      undefined, // No user title
      undefined,
      undefined
    );
    assertContains(result.title, 'John Wick');
    assertContains(result.title, '00:02:00');
  });

  totalTests++;
  passCount += runTest('Generate title from filename when media title is generic', () => {
    const result = MetadataGenerator.generateBookmarkMetadata(
      '/movies/the_matrix_1999.mp4',
      'Unknown Media',
      300,
      undefined,
      undefined,
      undefined
    );
    assertContains(result.title, 'The Matrix 1999');
    assertContains(result.title, '00:05:00');
  });

  totalTests++;
  passCount += runTest('Clean up filename for title generation', () => {
    const result = MetadataGenerator.generateBookmarkMetadata(
      '/movies/some_movie_with_underscores_and-dashes.mp4',
      'Unknown Media',
      60,
      undefined,
      undefined,
      undefined
    );
    assertContains(result.title, 'Some Movie With Underscores And Dashes');
  });

  totalTests++;
  passCount += runTest('Preserve user-provided title', () => {
    const result = MetadataGenerator.generateBookmarkMetadata(
      '/movies/action.mp4',
      'John Wick',
      120,
      'My Custom Title', // User provided title
      undefined,
      undefined
    );
    assertEqual(result.title, 'My Custom Title');
  });

  // Description Generation Tests
  console.log('\n📄 Description Generation Tests');

  totalTests++;
  passCount += runTest('Generate description with opening scene context', () => {
    const result = MetadataGenerator.generateBookmarkMetadata(
      '/movies/action.mp4',
      'John Wick',
      120, // 2 minutes - within opening scene threshold
      undefined,
      undefined,
      undefined
    );
    assertContains(result.description, 'Video bookmark');
    assertContains(result.description, 'Opening scene');
  });

  totalTests++;
  passCount += runTest('Generate description with timestamp context', () => {
    const result = MetadataGenerator.generateBookmarkMetadata(
      '/movies/action.mp4',
      'John Wick',
      1800, // 30 minutes
      undefined,
      undefined,
      undefined
    );
    assertContains(result.description, 'Video bookmark');
    assertContains(result.description, '30 minutes in');
  });

  totalTests++;
  passCount += runTest('Generate description for audio files', () => {
    const result = MetadataGenerator.generateBookmarkMetadata(
      '/music/song.mp3',
      'Great Song',
      45,
      undefined,
      undefined,
      undefined
    );
    assertContains(result.description, 'Audio bookmark');
  });

  totalTests++;
  passCount += runTest('Preserve user-provided description', () => {
    const result = MetadataGenerator.generateBookmarkMetadata(
      '/movies/action.mp4',
      'John Wick',
      120,
      undefined,
      'My custom description', // User provided description
      undefined
    );
    assertEqual(result.description, 'My custom description');
  });

  // Media Type Detection Tests
  console.log('\n🎥 Media Type Detection Tests');

  totalTests++;
  passCount += runTest('Detect video file types', () => {
    const videoExtensions = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'];
    videoExtensions.forEach(ext => {
      const mediaType = MetadataGenerator.getMediaType(ext);
      assertEqual(mediaType, 'Video', `Failed for extension: ${ext}`);
    });
  });

  totalTests++;
  passCount += runTest('Detect audio file types', () => {
    const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma'];
    audioExtensions.forEach(ext => {
      const mediaType = MetadataGenerator.getMediaType(ext);
      assertEqual(mediaType, 'Audio', `Failed for extension: ${ext}`);
    });
  });

  totalTests++;
  passCount += runTest('Handle unknown file types', () => {
    const mediaType = MetadataGenerator.getMediaType('xyz');
    assertEqual(mediaType, 'Media');
  });

  // Auto-Tag Generation Tests
  console.log('\n🏷️  Auto-Tag Generation Tests');

  totalTests++;
  passCount += runTest('Generate media type tags', () => {
    const videoTags = MetadataGenerator.generateAutoTags('/test/video.mp4', 'mp4', 'Test', 0);
    assertArrayContains(videoTags, 'video');

    const audioTags = MetadataGenerator.generateAutoTags('/test/audio.mp3', 'mp3', 'Test', 0);
    assertArrayContains(audioTags, 'audio');
  });

  totalTests++;
  passCount += runTest('Generate content type tags from path', () => {
    const movieTags = MetadataGenerator.generateAutoTags('/movies/action.mp4', 'mp4', 'Test', 0);
    assertArrayContains(movieTags, 'movie');

    const tvTags = MetadataGenerator.generateAutoTags('/tv/series/episode.mp4', 'mp4', 'Test', 0);
    assertArrayContains(tvTags, 'tv-show');

    const docTags = MetadataGenerator.generateAutoTags('/docs/nature.mp4', 'mp4', 'Test', 0);
    assertArrayContains(docTags, 'documentary');
  });

  totalTests++;
  passCount += runTest('Generate genre tags from title and path', () => {
    const actionTags = MetadataGenerator.generateAutoTags('/movies/action_movie.mp4', 'mp4', 'Action Hero', 0);
    assertArrayContains(actionTags, 'action');

    const comedyTags = MetadataGenerator.generateAutoTags('/movies/funny_film.mp4', 'mp4', 'Comedy Central', 0);
    assertArrayContains(comedyTags, 'comedy');

    const horrorTags = MetadataGenerator.generateAutoTags('/movies/scary.mp4', 'mp4', 'Horror Movie', 0);
    assertArrayContains(horrorTags, 'horror');
  });

  totalTests++;
  passCount += runTest('Generate temporal tags based on timestamp', () => {
    const openingTags = MetadataGenerator.generateAutoTags('/test/video.mp4', 'mp4', 'Test', 120);
    assertArrayContains(openingTags, 'opening');

    const beginningTags = MetadataGenerator.generateAutoTags('/test/video.mp4', 'mp4', 'Test', 400);
    assertArrayContains(beginningTags, 'beginning');
  });

  totalTests++;
  passCount += runTest('Generate quality tags from filename', () => {
    const hdTags = MetadataGenerator.generateAutoTags('/movies/film_1080p.mp4', 'mp4', 'Test', 0);
    assertArrayContains(hdTags, 'hd');

    const fourKTags = MetadataGenerator.generateAutoTags('/movies/film_4k.mp4', 'mp4', 'Test', 0);
    assertArrayContains(fourKTags, '4k');

    const sdTags = MetadataGenerator.generateAutoTags('/movies/film_720p.mp4', 'mp4', 'Test', 0);
    assertArrayContains(sdTags, '720p');
  });

  totalTests++;
  passCount += runTest('Limit tag count to reasonable number', () => {
    const tags = MetadataGenerator.generateAutoTags(
      '/movies/action_comedy_drama_thriller_horror_4k_hd_english_subtitled.mp4',
      'mp4',
      'Multi Genre Action Comedy Drama Thriller Horror Movie',
      120
    );
    assertTrue(tags.length <= 5, `Too many tags generated: ${tags.length}`);
  });

  totalTests++;
  passCount += runTest('Preserve user-provided tags', () => {
    const result = MetadataGenerator.generateBookmarkMetadata(
      '/movies/action.mp4',
      'John Wick',
      120,
      undefined,
      undefined,
      ['custom', 'user', 'tags'] // User provided tags
    );
    assertEqual(result.tags, ['custom', 'user', 'tags']);
  });

  // Comprehensive Scenario Tests
  console.log('\n🎬 Comprehensive Scenario Tests');

  // Test movie scenarios
  datasets.movieScenarios.forEach((scenario, index) => {
    totalTests++;
    passCount += runTest(`Movie scenario ${index + 1}: ${scenario.mediaTitle}`, () => {
      const result = MetadataGenerator.generateBookmarkMetadata(
        scenario.filepath,
        scenario.mediaTitle,
        scenario.timestamp,
        undefined,
        undefined,
        undefined
      );
      
      assertContains(result.title, scenario.expected.titleContains);
      assertContains(result.description, scenario.expected.descriptionContains);
      scenario.expected.tags.forEach(tag => {
        assertArrayContains(result.tags, tag, `Missing expected tag: ${tag}`);
      });
    });
  });

  // Test TV show scenarios
  datasets.tvShowScenarios.forEach((scenario, index) => {
    totalTests++;
    passCount += runTest(`TV show scenario ${index + 1}: ${scenario.mediaTitle}`, () => {
      const result = MetadataGenerator.generateBookmarkMetadata(
        scenario.filepath,
        scenario.mediaTitle,
        scenario.timestamp,
        undefined,
        undefined,
        undefined
      );
      
      assertContains(result.title, scenario.expected.titleContains);
      assertContains(result.description, scenario.expected.descriptionContains);
      scenario.expected.tags.forEach(tag => {
        assertArrayContains(result.tags, tag, `Missing expected tag: ${tag}`);
      });
    });
  });

  // Test work scenarios
  datasets.workScenarios.forEach((scenario, index) => {
    totalTests++;
    passCount += runTest(`Work scenario ${index + 1}: ${scenario.mediaTitle}`, () => {
      const result = MetadataGenerator.generateBookmarkMetadata(
        scenario.filepath,
        scenario.mediaTitle,
        scenario.timestamp,
        undefined,
        undefined,
        undefined
      );
      
      assertContains(result.title, scenario.expected.titleContains);
      assertContains(result.description, scenario.expected.descriptionContains);
      scenario.expected.tags.forEach(tag => {
        assertArrayContains(result.tags, tag, `Missing expected tag: ${tag}`);
      });
    });
  });

  // Edge Case Tests
  console.log('\n🛡️  Edge Case Tests');

  totalTests++;
  passCount += runTest('Handle unknown file extensions gracefully', () => {
    const result = MetadataGenerator.generateBookmarkMetadata(
      '/unknown/file.xyz',
      'Unknown Media',
      0,
      undefined,
      undefined,
      undefined
    );
    
    assertTrue(result.title.length > 0);
    assertTrue(result.description.length > 0);
    assertTrue(Array.isArray(result.tags));
  });

  totalTests++;
  passCount += runTest('Handle very long timestamps', () => {
    const result = MetadataGenerator.generateBookmarkMetadata(
      '/movies/long_movie.mp4',
      'Epic Movie',
      18000, // 5 hours
      undefined,
      undefined,
      undefined
    );
    
    assertContains(result.description, '300 minutes in');
  });

  totalTests++;
  passCount += runTest('Handle empty or null inputs gracefully', () => {
    const result = MetadataGenerator.generateBookmarkMetadata(
      '',
      '',
      0,
      undefined,
      undefined,
      undefined
    );
    
    assertTrue(result.title.length > 0);
    assertTrue(result.description.length > 0);
    assertTrue(Array.isArray(result.tags));
  });

  // Summary
  console.log('\n📊 Test Summary');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${totalTests - passCount}`);
  console.log(`Success Rate: ${((passCount / totalTests) * 100).toFixed(1)}%`);
  
  if (passCount === totalTests) {
    console.log('🎉 All metadata auto-population tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Please review the output above.');
  }
  
  return {
    total: totalTests,
    passed: passCount,
    failed: totalTests - passCount,
    successRate: (passCount / totalTests) * 100
  };
};

// Export for Node.js environment or run directly
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runMetadataTests,
    MetadataGenerator,
    createMetadataTestDatasets
  };
  // Auto-run tests when loaded in Node.js
  runMetadataTests();
} else {
  // Run tests if loaded in browser
  runMetadataTests();
} 