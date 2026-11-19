export type StoreProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  image: string;
  price: number;
  oldPrice?: number;
  rating: number;
  model: string;
  compatibility: string[];
  description: string;
  specs: { label: string; value: string }[];
};

// Display-only sample catalog. Replace this module with live catalog records when product data exists.
export const sampleProducts: StoreProduct[] = [
  {id:'gear-kit',name:'عدة حماية للقيادة',brand:'اختيار الخيال',category:'إكسسوارات',image:'/images/gear.jpg',price:1850,oldPrice:2200,rating:4.6,model:'Street · نموذج',compatibility:['دراجات متعددة · مثال توضيحي'],description:'نموذج بصري لعرض بطاقة الإكسسوارات؛ المواصفات والتوافق والأسعار المعروضة ليست عرضًا حقيقيًا.',specs:[{label:'الفئة',value:'معدات قيادة · نموذج'},{label:'الخامة',value:'غير محددة'},{label:'التوافق',value:'يحتاج تحققًا من رقم القطعة'}]},
  {id:'oil-20w50',name:'زيت محرك 4 أشواط',brand:'نموذج تجريبي',category:'زيوت ومحركات',image:'/images/oil.jpg',price:420,rating:4.4,model:'Scooter · نموذج',compatibility:['يُراجع دليل الشركة المصنّعة'],description:'صورة وبيانات نموذجية لعرض تصميم المتجر فقط؛ لا تمثل منتجًا متوفرًا أو توصية فنية.',specs:[{label:'الاستخدام',value:'مثال توضيحي'},{label:'اللزوجة',value:'غير مؤكدة'},{label:'التوافق',value:'يُراجع دليل الدراجة'}]},
  {id:'drive-kit',name:'طقم تروس وسلسلة',brand:'نموذج تجريبي',category:'سلاسل وجنازير',image:'/images/sprocket.jpg',price:1350,oldPrice:1590,rating:4.2,model:'Street · نموذج',compatibility:['يحتاج مطابقة المقاس'],description:'نموذج واجهة توضيحي؛ أرقام القطع والتوافق الفعلي غير متاحة.',specs:[{label:'الفئة',value:'نقل حركة · نموذج'},{label:'المقاس',value:'غير محدد'},{label:'التوافق',value:'تحقق من الموديل ورقم القطعة'}]},
  {id:'riding-gloves',name:'قفازات قيادة',brand:'نموذج تجريبي',category:'إكسسوارات',image:'/images/gloves.jpg',price:690,rating:4.5,model:'Sport · نموذج',compatibility:['مقاسات غير محددة'],description:'عنصر توضيحي لعرض الواجهة؛ المقاسات والتوفر غير مثبتين.',specs:[{label:'الفئة',value:'إكسسوارات · نموذج'},{label:'المقاسات',value:'غير متاحة'},{label:'التوافق',value:'اختيار المقاس قبل الشراء'}]},
  {id:'helmet-city',name:'خوذة قيادة يومية',brand:'نموذج تجريبي',category:'خوذات',image:'/images/gear.jpg',price:2450,oldPrice:2790,rating:4.3,model:'Scooter · نموذج',compatibility:['تُختار حسب المقاس'],description:'صورة وسعر تخيليان لغرض تصميم البطاقة؛ لا توجد بيانات اعتماد أو مخزون.',specs:[{label:'الفئة',value:'خوذة · نموذج'},{label:'المقاس',value:'غير محدد'},{label:'التوافق',value:'تحقق من المقاس ومعايير السلامة'}]},
  {id:'battery-12v',name:'بطارية دراجة 12V',brand:'نموذج تجريبي',category:'بطاريات وكهرباء',image:'/images/sprocket.jpg',price:1120,rating:4.1,model:'Street · نموذج',compatibility:['يتطلب مطابقة الجهد والأبعاد'],description:'نموذج بيانات واجهة لا يثبت وجود المنتج أو توافقه مع دراجتك.',specs:[{label:'الفئة',value:'بطارية · نموذج'},{label:'الجهد',value:'مثال فقط'},{label:'التوافق',value:'تحقق من الجهد والأبعاد'}]},
  {id:'tire-road',name:'إطار طريق',brand:'نموذج تجريبي',category:'كاوتش وإطارات',image:'/images/gear.jpg',price:1980,rating:4.0,model:'Scooter · نموذج',compatibility:['المقاس غير محدد'],description:'بيانات توضيحية فقط؛ المقاس والنوع والتوفر تحتاج تأكيدًا من المخزون.',specs:[{label:'الفئة',value:'إطار · نموذج'},{label:'المقاس',value:'غير محدد'},{label:'التوافق',value:'طابق المقاس المكتوب على الإطار'}]},
  {id:'brake-pads',name:'بطانات فرامل',brand:'نموذج تجريبي',category:'فرامل',image:'/images/sprocket.jpg',price:530,oldPrice:620,rating:4.3,model:'Street · نموذج',compatibility:['يتطلب مطابقة نوع المكابح'],description:'نموذج عرض فقط، وليس قطعة معروضة للبيع أو نصيحة بتركيبها.',specs:[{label:'الفئة',value:'فرامل · نموذج'},{label:'المقاس',value:'غير محدد'},{label:'التوافق',value:'فحص مختص قبل التركيب'}]},
  {id:'spark-plug',name:'شمعة إشعال',brand:'نموذج تجريبي',category:'بطاريات وكهرباء',image:'/images/oil.jpg',price:190,rating:4.2,model:'Sport · نموذج',compatibility:['يلزم التحقق من كود المحرك'],description:'بيانات وصورة نموذجية؛ لا تؤكد المخزون أو توافق المحرك.',specs:[{label:'الفئة',value:'كهرباء · نموذج'},{label:'الكود',value:'غير محدد'},{label:'التوافق',value:'راجع كتالوج الشركة'}]},
  {id:'brake-disc',name:'قرص فرامل',brand:'نموذج تجريبي',category:'فرامل',image:'/images/sprocket.jpg',price:1740,rating:4.1,model:'عام',compatibility:['الأبعاد غير محددة'],description:'عنصر تجريبي للواجهة فقط؛ لا يوجد رقم قطعة أو سجل مخزون فعلي.',specs:[{label:'الفئة',value:'قرص فرامل · نموذج'},{label:'الأبعاد',value:'غير محددة'},{label:'التوافق',value:'تأكد من رقم القطعة'}]},
  {id:'tool-kit',name:'طقم أدوات صيانة',brand:'نموذج تجريبي',category:'أدوات وصيانة',image:'/images/gear.jpg',price:980,rating:4.0,model:'عام',compatibility:['استخدام عام · نموذج'],description:'بيانات توضيحية لعرض تصميم صفحة القطعة.',specs:[{label:'الفئة',value:'أدوات · نموذج'},{label:'المحتوى',value:'غير محدد'},{label:'التوافق',value:'راجع محتويات الطقم'}]},
  {id:'mirror-pair',name:'مرايا جانبية (زوج)',brand:'نموذج تجريبي',category:'إكسسوارات',image:'/images/gloves.jpg',price:760,rating:4.2,model:'عام',compatibility:['تحقق من مقاس القلاوظ'],description:'عنصر توضيحي فقط؛ الأبعاد ونوع التركيب غير مؤكدة.',specs:[{label:'الفئة',value:'إكسسوارات · نموذج'},{label:'العدد',value:'زوج · مثال'},{label:'التوافق',value:'تحقق من القلاوظ'}]},
];
export const productCategories = ['قطع غيار','إكسسوارات','خوذات','كاوتش وإطارات','زيوت ومحركات','بطاريات وكهرباء','فرامل','سلاسل وجنازير','أدوات وصيانة'];
export const productModels = ['عام','Scooter · نموذج','Street · نموذج','Sport · نموذج'];
export const formatSamplePrice = (value:number) => `${new Intl.NumberFormat('ar-EG').format(value)} ج.م`;
