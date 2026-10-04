const fs = require('fs');
let content = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');

// Insert Payment and Assistants State
content = content.replace('const [services, setServices] = useState<any[]>([])', 'const [services, setServices] = useState<any[]>([])\n  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(false)\n  const [walletNumber, setWalletNumber] = useState(\'\')\n  const [instapayHandle, setInstapayHandle] = useState(\'\')\n  const [assistants, setAssistants] = useState<any[]>([])\n');

// Load state
content = content.replace('setServices(data.services || [', 'setOnlinePaymentEnabled(data.onlinePaymentEnabled || false)\n          setWalletNumber(data.walletNumber || \'\')\n          setInstapayHandle(data.instapayHandle || \'\')\n          setAssistants(data.assistants || [])\n          setServices(data.services || [');

// Save state
content = content.replace('aiInstructions,', 'aiInstructions,\n        onlinePaymentEnabled,\n        walletNumber,\n        instapayHandle,\n        assistants,');

// Import Lucide Icons
content = content.replace('import { Save, Plus, Trash2, Palette, ShieldAlert, Phone, MapPin, Bot } from \'lucide-react\'', 'import { Save, Plus, Trash2, Palette, ShieldAlert, Phone, MapPin, Bot, Wallet, Users } from \'lucide-react\'');

// Add UI Blocks
const uiBlock = `
          {/* Payment Settings */}
          <Card className="shadow-lg border-t-4 border-t-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-green-500"/> إعدادات الدفع</CardTitle>
              <CardDescription>فعل الدفع الإلكتروني ليتمكن المريض من الدفع أثناء الحجز.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-4 border rounded-xl bg-slate-50">
                <Switch checked={onlinePaymentEnabled} onCheckedChange={setOnlinePaymentEnabled} />
                <Label className="font-bold cursor-pointer">تفعيل خدمة الدفع الإلكتروني (فودافون كاش - انستاباي)</Label>
              </div>
              {onlinePaymentEnabled && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>رقم الكاش (محفظة إلكترونية)</Label>
                    <Input value={walletNumber} onChange={e => setWalletNumber(e.target.value)} dir="ltr" className="text-right" placeholder="01xxxxxxxxx" />
                  </div>
                  <div className="space-y-2">
                    <Label>حساب انستاباي (InstaPay Handle)</Label>
                    <Input value={instapayHandle} onChange={e => setInstapayHandle(e.target.value)} dir="ltr" className="text-right" placeholder="username@instapay" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assistants Settings */}
          <Card className="shadow-lg border-t-4 border-t-purple-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-purple-600"/> حسابات المساعدين</CardTitle>
              <CardDescription>قم بإنشاء حسابات لمساعديك للدخول إلى لوحة التحكم بصلاحيات محددة.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {assistants.map((assistant, index) => (
                <div key={index} className="flex flex-col md:flex-row items-end gap-4 p-4 bg-slate-50 border rounded-xl">
                  <div className="flex-1 space-y-2 w-full">
                    <Label>اسم المساعد</Label>
                    <Input value={assistant.name} onChange={e => {
                      const newA = [...assistants]; newA[index].name = e.target.value; setAssistants(newA);
                    }} />
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    <Label>البريد الإلكتروني</Label>
                    <Input value={assistant.email} onChange={e => {
                      const newA = [...assistants]; newA[index].email = e.target.value; setAssistants(newA);
                    }} dir="ltr" className="text-right" />
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    <Label>كلمة المرور</Label>
                    <Input value={assistant.password} onChange={e => {
                      const newA = [...assistants]; newA[index].password = e.target.value; setAssistants(newA);
                    }} dir="ltr" className="text-right" />
                  </div>
                  <Button variant="ghost" className="text-red-500 hover:bg-red-100 mb-1" onClick={() => {
                    setAssistants(assistants.filter((_, i) => i !== index));
                  }}><Trash2 className="w-5 h-5" /></Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => {
                setAssistants([...assistants, { name: '', email: '', password: '' }])
              }} className="w-full border-dashed border-2">
                <Plus className="w-4 h-4 ml-2" /> إضافة مساعد جديد
              </Button>
            </CardContent>
          </Card>
`;

content = content.replace('<Card className="shadow-lg border-t-4 border-t-teal-500">', uiBlock + '\n          <Card className="shadow-lg border-t-4 border-t-teal-500">');

fs.writeFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', content);
console.log('Successfully updated settings/page.tsx');
