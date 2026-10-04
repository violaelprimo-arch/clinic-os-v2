const fs = require('fs');
let content = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8');

const newDialogUI = `
                {/* Manage Favorites Dialog */}
                <Dialog open={isFavoritesOpen} onOpenChange={setIsFavoritesOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="h-12 border-primary/20 text-primary hover:bg-primary/5 px-6">
                      <Star className="w-5 h-5 ml-2 fill-primary" /> إدارة أدويتي
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl" dir="rtl">
                    <DialogHeader>
                      <DialogTitle className="text-xl flex items-center gap-2 text-primary">
                        <Pill className="w-6 h-6 fill-primary/20 text-primary" /> إدارة الأدوية الخاصة بالعيادة
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 my-2">
                      <div className="bg-slate-50 p-4 rounded-xl border">
                        <Label className="font-bold text-primary mb-2 block">إضافة أدوية متعددة دفعة واحدة (Bulk Add)</Label>
                        <p className="text-sm text-slate-500 mb-2">انسخ أسماء الأدوية الخاصة بتخصصك من أي ملف (Excel أو Word) والصقها هنا، بحيث يكون كل دواء في سطر منفصل.</p>
                        <div className="flex gap-2">
                          <textarea 
                            id="bulkDrugsInput"
                            placeholder="مثال:
Amoxicillin 500mg
Panadol Extra
Brufen 400" 
                            className="w-full h-24 p-2 text-sm border rounded-md"
                            dir="ltr"
                          />
                          <Button 
                            className="h-24 px-8 font-bold"
                            onClick={async () => {
                              const textarea = document.getElementById('bulkDrugsInput') as HTMLTextAreaElement;
                              const lines = textarea.value.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
                              if(lines.length === 0) return toast.error('الرجاء إدخال أدوية أولاً');
                              if(!clinicId) return;
                              
                              const newCustom = [...new Set([...customDrugs, ...lines])];
                              setCustomDrugs(newCustom);
                              try {
                                await updateDoc(doc(db, 'clinics', clinicId), { customDrugs: newCustom });
                                toast.success(\`تم إضافة \${lines.length} دواء بنجاح!\`);
                                textarea.value = '';
                              } catch(err) {
                                toast.error('حدث خطأ');
                              }
                            }}
                          >
                            حفظ <br/> الكل
                          </Button>
                        </div>
                      </div>

                      <div className="max-h-64 overflow-y-auto px-2">
                        <h4 className="font-bold mb-2">الأدوية المفضلة والخاصة بك ({favoriteDrugs.length + customDrugs.length})</h4>
                        {favoriteDrugs.length === 0 && customDrugs.length === 0 ? (
                          <p className="text-center text-slate-500 py-4">لا توجد أدوية خاصة بك حتى الآن.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {[...new Set([...favoriteDrugs, ...customDrugs])].map(drug => (
                              <div key={drug} className="flex justify-between items-center p-2 border rounded-xl bg-white hover:bg-slate-50 transition-colors">
                                <span className="font-bold text-sm text-primary truncate pl-2" dir="ltr">{drug}</span>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 shrink-0"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if(!clinicId) return;
                                    const newFavs = favoriteDrugs.filter(d => d !== drug);
                                    const newCustom = customDrugs.filter(d => d !== drug);
                                    setFavoriteDrugs(newFavs);
                                    setCustomDrugs(newCustom);
                                    await updateDoc(doc(db, 'clinics', clinicId), { favoriteDrugs: newFavs, customDrugs: newCustom });
                                    toast.success('تم الحذف');
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
`;

content = content.replace(/\{\/\* Manage Favorites Dialog \*\/\}.*?<\/Dialog>/s, newDialogUI);

// Wait, I previously stripped out DialogTrigger asChild in my previous fix! 
// Let's make sure I'm replacing the exact block correctly.
// I will just use a precise regex to match from `{/* Manage Favorites Dialog */}` to `</Dialog>`.

fs.writeFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', content);
console.log('Fixed Bulk Add UI');
