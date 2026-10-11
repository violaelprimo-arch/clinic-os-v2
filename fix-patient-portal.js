const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/patient/page.tsx', 'utf8');

const uiFind = `                    {/* Visit Medical Details */}
                    <div className="pt-3 border-t border-dashed border-[#E5EAF0] space-y-4">
                      
                      {/* Diagnosis */}
                      {appt.diagnosis ? (`;

const uiReplace = `                    {/* Visit Medical Details */}
                    {(clinic?.allowPatientMedicalView !== false) ? (
                    <div className="pt-3 border-t border-dashed border-[#E5EAF0] space-y-4">
                      
                      {/* Diagnosis */}
                      {appt.diagnosis ? (`

const uiFind2 = `                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>`;

const uiReplace2 = `                          </div>
                        </div>
                      )}
                    </div>
                    ) : (
                      <div className="pt-3 border-t border-dashed border-[#E5EAF0]">
                        <p className="text-xs font-bold text-slate-400 text-center py-2">
                          التفاصيل الطبية للزيارة مخفية بناءً على إعدادات العيادة.
                        </p>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>`;

c = c.replace(uiFind, uiReplace);
c = c.replace(uiFind2, uiReplace2);

fs.writeFileSync('src/app/clinic/[slug]/patient/page.tsx', c);
