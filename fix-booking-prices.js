const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');

const uiFind1 = `{service.desc || 'وصف الخدمة غير متوفر'} • {service.duration || 'حوالي 15 دقيقة'}
                          </p>
                        </div>
                        <div className="text-left shrink-0">
                          <span className="font-black text-sm text-[#182230]">{service.price} ج.م</span>
                        </div>
                      </div>
                    </label>
                  </div>`;
                  
const uiReplace1 = `{service.desc || 'وصف الخدمة غير متوفر'} • {service.duration || 'حوالي 15 دقيقة'}
                          </p>
                        </div>
                        <div className="text-left shrink-0">
                          {!clinic?.hidePrices && <span className="font-black text-sm text-[#182230]">{service.price} ج.م</span>}
                        </div>
                      </div>
                    </label>
                  </div>`;
                  
c = c.replace(uiFind1, uiReplace1);

const uiFind2 = `<div className="flex justify-between items-center py-2 border-b border-[#E5EAF0]">
              <span className="text-slate-600 font-bold">التكلفة الإجمالية:</span>
              <div className="text-left">
                <span className="font-black text-base text-[#15B8A6]">{selectedService.price} ج.م</span>
              </div>
            </div>`;
            
const uiReplace2 = `{!clinic?.hidePrices && (
            <div className="flex justify-between items-center py-2 border-b border-[#E5EAF0]">
              <span className="text-slate-600 font-bold">التكلفة الإجمالية:</span>
              <div className="text-left">
                <span className="font-black text-base text-[#15B8A6]">{selectedService.price} ج.م</span>
              </div>
            </div>
            )}`;
            
c = c.replace(uiFind2, uiReplace2);

fs.writeFileSync('src/components/clinic/BookingForm.tsx', c);
