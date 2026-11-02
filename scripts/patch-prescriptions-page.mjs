import fs from 'fs'

const filePath = 'src/app/clinic/[slug]/admin/prescriptions/page.tsx'
let content = fs.readFileSync(filePath, 'utf8')

// Detect and normalize line endings
const isCrlf = content.includes('\r\n')
const normalized = content.replace(/\r\n/g, '\n')

// 1. Patient Details Card Header Button
const targetHeader = `          {/* Patient Details Card */}
          <div className="yalla-card p-5 space-y-4 border border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-primary" />
                {t('patient_visit_info', 'بيانات المريض والزيارة')}
              </h3>

              {filteredTodayPatients.length > 0 && (`

const replacementHeader = `          {/* Patient Details Card */}
          <div className="yalla-card p-5 space-y-4 border border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border flex-wrap gap-2">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-primary" />
                {t('patient_visit_info', 'بيانات المريض والزيارة')}
              </h3>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Open Patient Medical Profile in New Tab */}
                {hasPatientSelected ? (
                  <a
                    href={patientProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 transition-all cursor-pointer shadow-xs hover:shadow-sm"
                    title={t('open_patient_profile_tooltip', 'فتح الملف الطبي الكامل للمريض في تبويب جديد (دون فقدان بيانات الروشتة الحالية)')}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{t('open_patient_profile', 'فتح ملف المريض')}</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-muted/60 text-muted-foreground/70 border border-border/60 opacity-60 cursor-not-allowed"
                    title={t('select_patient_first_tooltip', 'اختر المريض أولًا لفتح ملفه الطبي')}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{t('open_patient_profile', 'فتح ملف المريض')}</span>
                    <span className="text-[10px] font-normal text-muted-foreground/80">({t('select_patient_first', 'اختر المريض أولًا')})</span>
                  </button>
                )}

                {filteredTodayPatients.length > 0 && (`

// 1B. Select tag close wrapper
const targetSelectEnd = `                  {filteredTodayPatients.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.queue_number} - {p.patientName} {p.branchName ? \`(\${tDynamic(p.branchName)})\` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>`

const replacementSelectEnd = `                  {filteredTodayPatients.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.queue_number} - {p.patientName} {p.branchName ? \`(\${tDynamic(p.branchName)})\` : ''}
                    </option>
                  ))}
                </select>
              )}
              </div>
            </div>`

// 2. Replace instructions input with InstructionAutocompleteInput
const targetInstructions = `            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-muted-foreground">{t('doctor_instructions', 'تعليمات وإرشادات الطبيب للمريض')}</Label>
                <VoiceDictationButton
                  fieldId="instructions"
                  fieldLabel={t('doctor_instructions', 'تعليمات وإرشادات الطبيب للمريض')}
                  value={instructions}
                  onChange={setInstructions}
                  inputRef={instructionsInputRef}
                  language={dictationLang}
                  onLanguageChange={setDictationLang}
                  size="sm"
                />
              </div>
              <Input
                ref={instructionsInputRef}
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder={t('doctor_instructions_placeholder', 'مثال: شرب سوائل دافئة، الراحة التامة، العودة للاستشارة بعد أسبوع')}
                className="h-10 text-xs rounded-xl bg-background border-border text-foreground"
              />
            </div>`

const replacementInstructions = `            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-muted-foreground">{t('doctor_instructions', 'تعليمات وإرشادات الطبيب للمريض')}</Label>
                <VoiceDictationButton
                  fieldId="instructions"
                  fieldLabel={t('doctor_instructions', 'تعليمات وإرشادات الطبيب للمريض')}
                  value={instructions}
                  onChange={setInstructions}
                  inputRef={instructionsInputRef}
                  language={dictationLang}
                  onLanguageChange={setDictationLang}
                  size="sm"
                />
              </div>
              <InstructionAutocompleteInput
                inputRef={instructionsInputRef}
                value={instructions}
                onChange={setInstructions}
                suggestions={instructionsSuggestions}
                placeholder={t('doctor_instructions_placeholder', 'مثال: شرب سوائل دافئة، الراحة التامة، العودة للاستشارة بعد أسبوع')}
                typeLabel={t('doctor_instructions', 'التعليمات والإرشادات')}
                className="h-10 text-xs rounded-xl bg-background border-border text-foreground"
              />
            </div>`

// 3. Replace drug dosage and duration inputs with InstructionAutocompleteInput
const targetDrugDosageDuration = `                    <div className="sm:col-span-4">
                      <div className="relative flex items-center">
                        <Input
                          value={drug.dosage}
                          onChange={e => updateDrug(drug.id, 'dosage', e.target.value)}
                          placeholder={t('dosage_label', 'الجرعة (مثال: قرص كل 12 ساعة)')}
                          className="h-9 pe-8 text-xs rounded-lg bg-background border-border text-foreground"
                        />
                        <div className="absolute end-1 flex items-center">
                          <VoiceDictationButton
                            fieldId={\`drug-dosage-\${drug.id}\`}
                            fieldLabel={\`\${t('dosage_label', 'الجرعة')} #\${index + 1}\`}
                            value={drug.dosage}
                            onChange={val => updateDrug(drug.id, 'dosage', val)}
                            language={dictationLang}
                            onLanguageChange={setDictationLang}
                            size="sm"
                            showLanguagePill={false}
                            showStatusBadge={false}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <div className="relative flex items-center">
                        <Input
                          value={drug.duration}
                          onChange={e => updateDrug(drug.id, 'duration', e.target.value)}
                          placeholder={t('duration_label', 'المدة (مثال: 5 أيام)')}
                          className="h-9 pe-8 text-xs rounded-lg bg-background border-border text-foreground"
                        />
                        <div className="absolute end-1 flex items-center">
                          <VoiceDictationButton
                            fieldId={\`drug-duration-\${drug.id}\`}
                            fieldLabel={\`\${t('duration_label', 'المدة')} #\${index + 1}\`}
                            value={drug.duration}
                            onChange={val => updateDrug(drug.id, 'duration', val)}
                            language={dictationLang}
                            onLanguageChange={setDictationLang}
                            size="sm"
                            showLanguagePill={false}
                            showStatusBadge={false}
                          />
                        </div>
                      </div>
                    </div>`

const replacementDrugDosageDuration = `                    <div className="sm:col-span-4">
                      <InstructionAutocompleteInput
                        id={\`drug-dosage-input-\${drug.id}\`}
                        value={drug.dosage}
                        onChange={val => updateDrug(drug.id, 'dosage', val)}
                        suggestions={dosageSuggestions}
                        placeholder={t('dosage_label', 'الجرعة (مثال: قرص كل 12 ساعة)')}
                        typeLabel={t('dosage_label', 'الجرعة')}
                        className="pe-8"
                        rightElement={
                          <VoiceDictationButton
                            fieldId={\`drug-dosage-\${drug.id}\`}
                            fieldLabel={\`\${t('dosage_label', 'الجرعة')} #\${index + 1}\`}
                            value={drug.dosage}
                            onChange={val => updateDrug(drug.id, 'dosage', val)}
                            language={dictationLang}
                            onLanguageChange={setDictationLang}
                            size="sm"
                            showLanguagePill={false}
                            showStatusBadge={false}
                          />
                        }
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <InstructionAutocompleteInput
                        id={\`drug-duration-input-\${drug.id}\`}
                        value={drug.duration}
                        onChange={val => updateDrug(drug.id, 'duration', val)}
                        suggestions={durationSuggestions}
                        placeholder={t('duration_label', 'المدة (مثال: 5 أيام)')}
                        typeLabel={t('duration_label', 'المدة')}
                        className="pe-8"
                        rightElement={
                          <VoiceDictationButton
                            fieldId={\`drug-duration-\${drug.id}\`}
                            fieldLabel={\`\${t('duration_label', 'المدة')} #\${index + 1}\`}
                            value={drug.duration}
                            onChange={val => updateDrug(drug.id, 'duration', val)}
                            language={dictationLang}
                            onLanguageChange={setDictationLang}
                            size="sm"
                            showLanguagePill={false}
                            showStatusBadge={false}
                          />
                        }
                      />
                    </div>`

// 4. Save suggestions in handleSave
const targetSaveAudit = `        // Record Audit Log
        try {
          const { recordAuditLog } = await import('@/lib/audit-logger')
          recordAuditLog({
            action: 'PRESCRIPTION_CREATED',
            actorName: clinic?.doctorName || 'طبيب العيادة',
            actorRole: 'doctor',
            clinicId,
            details: { prescriptionId: docRef.id, patientName, patientPhone, appointmentId }
          })
        } catch (e) {}`

const replacementSaveAudit = `        // Record Audit Log
        try {
          const { recordAuditLog } = await import('@/lib/audit-logger')
          recordAuditLog({
            action: 'PRESCRIPTION_CREATED',
            actorName: clinic?.doctorName || 'طبيب العيادة',
            actorRole: 'doctor',
            clinicId,
            details: { prescriptionId: docRef.id, patientName, patientPhone, appointmentId }
          })
        } catch (e) {}

        // Persist used dosage, duration, and instructions to clinic suggestions bank
        try {
          const itemsToSave: Array<{ type: 'dosage' | 'duration' | 'instruction'; text: string }> = []
          for (const d of drugs) {
            if (d.dosage && typeof d.dosage === 'string' && d.dosage.trim().length >= 2) {
              itemsToSave.push({ type: 'dosage', text: d.dosage.trim() })
            }
            if (d.duration && typeof d.duration === 'string' && d.duration.trim().length >= 2) {
              itemsToSave.push({ type: 'duration', text: d.duration.trim() })
            }
          }
          if (instructions && typeof instructions === 'string' && instructions.trim().length >= 3) {
            itemsToSave.push({ type: 'instruction', text: instructions.trim() })
          }
          if (itemsToSave.length > 0 && clinicId) {
            savePrescriptionSuggestions(clinicId, itemsToSave, clinic?.doctorEmail).catch(() => {})
            // Update in-memory suggestions immediately for current session
            setDosageSuggestions(prev => {
              const newItems = itemsToSave.filter(i => i.type === 'dosage').map(i => i.text)
              return Array.from(new Set([...newItems, ...prev]))
            })
            setDurationSuggestions(prev => {
              const newItems = itemsToSave.filter(i => i.type === 'duration').map(i => i.text)
              return Array.from(new Set([...newItems, ...prev]))
            })
            setInstructionsSuggestions(prev => {
              const newItems = itemsToSave.filter(i => i.type === 'instruction').map(i => i.text)
              return Array.from(new Set([...newItems, ...prev]))
            })
          }
        } catch (e) {
          console.warn('Error saving prescription suggestions:', e)
        }`

// Verify matches
let patched = normalized
const checks = [
  { name: 'targetHeader', match: patched.includes(targetHeader), run: () => { patched = patched.replace(targetHeader, replacementHeader) } },
  { name: 'targetSelectEnd', match: patched.includes(targetSelectEnd), run: () => { patched = patched.replace(targetSelectEnd, replacementSelectEnd) } },
  { name: 'targetInstructions', match: patched.includes(targetInstructions), run: () => { patched = patched.replace(targetInstructions, replacementInstructions) } },
  { name: 'targetDrugDosageDuration', match: patched.includes(targetDrugDosageDuration), run: () => { patched = patched.replace(targetDrugDosageDuration, replacementDrugDosageDuration) } },
  { name: 'targetSaveAudit', match: patched.includes(targetSaveAudit), run: () => { patched = patched.replace(targetSaveAudit, replacementSaveAudit) } },
]

for (const c of checks) {
  console.log(`Checking ${c.name}: ${c.match ? 'FOUND' : 'NOT FOUND'}`)
  if (!c.match) {
    process.exit(1)
  }
  c.run()
}

// Convert back to original line endings if CRLF
if (isCrlf) {
  patched = patched.replace(/\n/g, '\r\n')
}

fs.writeFileSync(filePath, patched, 'utf8')
console.log('Successfully patched prescriptions page.tsx!')
