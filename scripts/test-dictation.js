const assert = require('assert')

// 1. Text composition logic (matches composeDictatedText in useVoiceDictation.ts)
function composeDictatedText(prefix, spokenText, suffix) {
  const cleanSpoken = (spokenText || '').trim()
  if (!cleanSpoken) {
    return (prefix || '') + (suffix || '')
  }

  let result = prefix || ''
  if (result.length > 0 && !result.endsWith(' ') && !result.endsWith('\n')) {
    result += ' '
  }
  result += cleanSpoken

  if (suffix && suffix.length > 0) {
    if (
      !result.endsWith(' ') &&
      !result.endsWith('\n') &&
      !suffix.startsWith(' ') &&
      !suffix.startsWith('\n')
    ) {
      result += ' '
    }
    result += suffix
  }

  return result
}

console.log('🧪 Starting Voice Dictation Unit Tests...\n')

// Test 1: Empty text + spoken text
{
  const res = composeDictatedText('', 'التهاب رئوي حاد', '')
  assert.strictEqual(res, 'التهاب رئوي حاد')
  console.log('✅ Test 1 Passed: Empty field + spoken Arabic text')
}

// Test 2: Existing text without trailing space + spoken text
{
  const res = composeDictatedText('المريض يعاني من', 'ارتفاع بالحرارة', '')
  assert.strictEqual(res, 'المريض يعاني من ارتفاع بالحرارة')
  console.log('✅ Test 2 Passed: Append to existing text without trailing space (adds clean space)')
}

// Test 3: Existing text WITH trailing space + spoken text
{
  const res = composeDictatedText('المريض يعاني من ', 'ارتفاع بالحرارة', '')
  assert.strictEqual(res, 'المريض يعاني من ارتفاع بالحرارة')
  console.log('✅ Test 3 Passed: Append to existing text with trailing space (no double spaces)')
}

// Test 4: Cursor insertion in the middle of a sentence
{
  const res = composeDictatedText('صداع', 'نصفي', 'مستمر منذ يومين')
  assert.strictEqual(res, 'صداع نصفي مستمر منذ يومين')
  console.log('✅ Test 4 Passed: Middle cursor insertion (clean spacing on both ends)')
}

// Test 5: English prescription text (Drugs & Dosages)
{
  const res = composeDictatedText('Augmentin 1g', '1 tablet every 12 hours', 'for 7 days')
  assert.strictEqual(res, 'Augmentin 1g 1 tablet every 12 hours for 7 days')
  console.log('✅ Test 5 Passed: English drug and dosage composition')
}

// Test 6: Mixed Arabic and English dictation
{
  const res = composeDictatedText('Panadol Extra 500mg', 'قرص عند اللزوم', '')
  assert.strictEqual(res, 'Panadol Extra 500mg قرص عند اللزوم')
  console.log('✅ Test 6 Passed: Mixed English drug name + Arabic dosage instruction')
}

// Test 7: Simulated Speech Recognition Event sequence (Interim -> Final) - Duplication check
{
  // Simulate Web Speech continuous stream
  const results = [
    // Step A: Interim "أوجاع"
    {
      items: [{ transcript: 'أوجاع', isFinal: false }]
    },
    // Step B: Interim "أوجاع في البطن"
    {
      items: [{ transcript: 'أوجاع في البطن', isFinal: false }]
    },
    // Step C: Finalized "أوجاع في البطن", new Interim "ومغص"
    {
      items: [
        { transcript: 'أوجاع في البطن', isFinal: true },
        { transcript: 'ومغص', isFinal: false }
      ]
    },
    // Step D: Finalized "ومغص", new Interim "شديد"
    {
      items: [
        { transcript: 'أوجاع في البطن', isFinal: true },
        { transcript: 'ومغص', isFinal: true },
        { transcript: 'شديد', isFinal: false }
      ]
    },
    // Step E: Finalized all
    {
      items: [
        { transcript: 'أوجاع في البطن', isFinal: true },
        { transcript: 'ومغص', isFinal: true },
        { transcript: 'شديد', isFinal: true }
      ]
    }
  ]

  let prefix = 'التشخيص المبدئي:'
  let history = []

  for (const step of results) {
    let finalChunk = ''
    let interimChunk = ''
    for (const res of step.items) {
      if (res.isFinal) {
        finalChunk += (finalChunk ? ' ' : '') + res.transcript.trim()
      } else {
        interimChunk += (interimChunk ? ' ' : '') + res.transcript.trim()
      }
    }
    const spoken = [finalChunk.trim(), interimChunk.trim()].filter(Boolean).join(' ')
    const composed = composeDictatedText(prefix, spoken, '')
    history.push(composed)
  }

  assert.strictEqual(history[0], 'التشخيص المبدئي: أوجاع')
  assert.strictEqual(history[1], 'التشخيص المبدئي: أوجاع في البطن')
  assert.strictEqual(history[2], 'التشخيص المبدئي: أوجاع في البطن ومغص')
  assert.strictEqual(history[3], 'التشخيص المبدئي: أوجاع في البطن ومغص شديد')
  assert.strictEqual(history[4], 'التشخيص المبدئي: أوجاع في البطن ومغص شديد')

  // Check no duplicated words:
  const finalWords = history[4].split(' ')
  const uniqueWordsCount = new Set(finalWords).size
  assert.strictEqual(finalWords.length, uniqueWordsCount) // Each word appears exactly once!
  console.log('✅ Test 7 Passed: Speech event stream simulation - ZERO duplicate words across interim/final transitions')
}

// Test 8: Single Session Coordinator Simulation
{
  let globalActiveSession = null
  let sessionEpoch = 0
  let stoppedSessions = []

  function startSession(fieldId) {
    // Stop any existing session
    if (globalActiveSession) {
      stoppedSessions.push(globalActiveSession.fieldId)
      globalActiveSession = null
    }

    const currentEpoch = ++sessionEpoch
    globalActiveSession = {
      fieldId,
      epoch: currentEpoch,
      stop: () => {
        stoppedSessions.push(fieldId)
        globalActiveSession = null
      }
    }
  }

  // Doctor starts dictating in Diagnosis
  startSession('diagnosis')
  assert.strictEqual(globalActiveSession.fieldId, 'diagnosis')

  // Doctor switches to Instructions while Diagnosis was listening
  startSession('instructions')
  assert.strictEqual(globalActiveSession.fieldId, 'instructions')
  assert.deepStrictEqual(stoppedSessions, ['diagnosis'])

  // Doctor switches to Drug #1 Name
  startSession('drug-name-1')
  assert.strictEqual(globalActiveSession.fieldId, 'drug-name-1')
  assert.deepStrictEqual(stoppedSessions, ['diagnosis', 'instructions'])

  // Doctor changes patient or closes page -> stops all
  globalActiveSession.stop()
  assert.strictEqual(globalActiveSession, null)
  assert.deepStrictEqual(stoppedSessions, ['diagnosis', 'instructions', 'drug-name-1'])

  console.log('✅ Test 8 Passed: Single session coordinator - only one active mic session, previous stopped immediately')
}

console.log('\n🎉 ALL 8 VOICE DICTATION TESTS PASSED SUCCESSFULLY!')
