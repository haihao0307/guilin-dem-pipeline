import {stageRadialSkirt} from '../../../correctives/r043b/radial-assembly.mjs';
import {configureMaterialBending} from '../../../correctives/r043b/hinge-bending.mjs';
import {beginMaterialRefinement} from '../../../correctives/r043c/seam-frames.mjs';
import {prepareNativeSource} from '../../../source-repair-r043.mjs';
import {attachExteriorField,waistCircuit} from '../../../correctives/r043/fit-support.mjs';
import {sha,requirePerson,materialHash} from '../../../source-contract.mjs';
const R04_LOCK={"schema":"kaopu-native-tailor-lock@1","version":"R04-SOURCE-1","nativeAnchor":"0ff632be3e4ab112fad93fd4c43c7bc6a90cf5f3","commonEntry":"https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/index-characters-r02.html","commonFull":"https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/full/","person":{"geometrySHA256":"fbc056553c1731b790769124bee121554f0800400271eaf564a0ad5e6f458571","topologySHA256":"e8526431b9b24bec71d8161ed409794a8398ffc68ad25800abb27e0fc09644de","stateSHA256":"f6a60588040d2967ac619c5352c52355cbd02b12890f88cc976d0c2fbe50c0b7","adapterFingerprint":"4ac1f6b9ffac5ab45d1a427a1eb5e9578af0e7f105d58bff4d48555e4e2027a5"},"vertices":25417,"triangles":50624,"groundShiftM":0.9858653545379639,"bodyFileSHA256":"9193aded7fa9c7d14436b5de84469e09fd51ea0bd7727fe6e4c20f06e237e31c","sdfFileSHA256":"e60cea26e250863dd74e27434e5e7140db35a93d9b341c0249c2db3a1530ab56","sdfMetadataSHA256":"42985dc3db3214ce2b71aa91f4f9910841d0b04812aa4350b94d65965c40ba35","cppSHA256":"58497fbc68140d2d439ec93e1f488783e48ab715e3a22b29d16db1ad7ca40dfc","bodySourceComparison":{"canonicalRecipesChecked":8795,"maxDefaultBodyErrorMmBelow1490":0.0},"sizingPolicy":"PRESERVED_ORIGINAL_PAPER_SIZE_NOT_CURRENT_PERSON_REMEASURED","supportedCollisionPerson":"exact default native state only; other native characters require their own collider and measurements","noBodyScale":true,"garmentDisplayProxyAllowed":false,"physicalFitAccepted":false};
const R04_ROWS={"T01":{"id":"T01","style":"Shirt","recipeHash":"823103e24349c2650f7328dec3d010afa070d5012a2135868c95e1c0d98a2151","geometryHash":"94dd4ccfc9f8bc305f88381ecf0f31899559b4d6442a0f2249b6d1e0af1a724f","decodedSHA256":"5ae24624797b4eee8801551b833ab0d4b5cea1a6d93612940d01b3f5e936527d"},"T02":{"id":"T02","style":"FittedShirt","recipeHash":"4dd377515e120e5c7bbd5d639405ea41a8050dbe54d66fbf159984395e047a53","geometryHash":"17ef6b618b4d31d2a6abedc90fbe886511df20f24aacf84f333cf4f4fd390c7f","decodedSHA256":"686b15b890df8048364b63f531133194218486d729fb3dd0413e301b96332c5e"},"T03":{"id":"T03","style":"Shirt","recipeHash":"6b39ad161eff755a32bc3610b107a5bf4f181ba978bd95671241e4ba817407ca","geometryHash":"7ad801ca43aa6d13341218aeb70fa25b40ff1f31414da9742863cc456f085169","decodedSHA256":"3240c5d9b130f74b9b79300655d13694bfca455c0d55536cf123f4ec1d87973b"},"T04":{"id":"T04","style":"Shirt","recipeHash":"824ca0d7dfdf4497128c44475cb4a85428bcb46016a6bad583b8ab4ddaf93911","geometryHash":"95ff73d426e6e3ba2d0d6582b30f69549bb927ab4f07c5b0dc592a9986d2fbce","decodedSHA256":"a43f45756e6b23d8b1c0923f6709447c1d5f279a3e68efe89f6b0b8c5db852f5"},"T05":{"id":"T05","style":"Shirt","recipeHash":"9f2e2c762bdcf52ea8243af33760ab2f916529358a048190a7bf6f4a20de0e5a","geometryHash":"ff70b845e90facfdf7e5c927fc2e7c5ce71a22071a527df3c6ebb1037a082bc6","decodedSHA256":"f4d8556c8de9977c35e0b96cccd2f75ab3ab3d44fa59ccacf51ab163e663f84e"},"T06":{"id":"T06","style":"LongSleeve","recipeHash":"ec6c46304fb7d36a7a040241ae49c7c6214e79bed8818bc3a96b9071b09f35cc","geometryHash":"d52bd758171dd0fa4b81e2ab00fd0bfcb9bb122289e6266b36103dd3b1a2e717","decodedSHA256":"7187456e5a3ff75f3e187f3a90b820619662087f7abfc0cdd1c0ef4a48f675c6"},"T07":{"id":"T07","style":"Shirt","recipeHash":"979d58b24c6fec3206d89f05ceda37d8a2c00f430d0409ea72f4934771743881","geometryHash":"1f85fd57a42348eec6f844f38017c94ce431d4ae72fc56d7de9e6493a4c5c9f5","decodedSHA256":"6618a0dd354c5aebc642cf6e10df846bec9f4830c9fa7fa3a6dff1713597e3dd"},"T08":{"id":"T08","style":"Turtle","recipeHash":"18ab681f7f560577d1d49ed317b0595bdffd8c9964b95be3489d89849c1a9d63","geometryHash":"5d3d40c7911c776b7b65fdc57e1bd30e13e4d239a817e202a0460c8185e6fc24","decodedSHA256":"0e09e1ae5f2ea2df31b9ab4408d712f64c39b97356abedc76beae7a501c62507"},"T09":{"id":"T09","style":"SimpleLapel","recipeHash":"bebd0d83a0ea4ade6867e540e66f7ea8e711bb860b6e45ef83dec866159cecd1","geometryHash":"96d1bb7c807209dd86b4781a420272cd4a09b42a66945f716b98c8e2dfa95a0e","decodedSHA256":"04113f4e1a62426781529d6bf7dbe2c74246e702a210bc097cd308d32872a36c"},"T10":{"id":"T10","style":"Hood2Panels","recipeHash":"a45e4a0d3159f55bef6270424bc171f172ca1be77c757706d5d68546a2b96ef7","geometryHash":"f5baa9594d1b125d8ea14c56cdea4c4c58cf508c2c1dfaa891230a8969bb3ca0","decodedSHA256":"4875cb8e202f875d100f7027f5da7cceb69d5f4fbebc4f126aa0b2077950bd56"},"T11":{"id":"T11","style":"CuffBand","recipeHash":"9be65342116566e76d4ceb0947bb5d344ba3c972f93735ab4884d77f0901ae4b","geometryHash":"2302fb43fe84d53f0860d83567e70879513e22f65ba0c01f39d45663f293cc54","decodedSHA256":"597f46eceff25d3af1aa4ce74e5df9040ed2977d712af1abe37a8f398b52dec5"},"T12":{"id":"T12","style":"CuffSkirt","recipeHash":"cee574e3bc7ffaef233ae4482552e74499d5b2a0524c24b0aa60ae806f1006b2","geometryHash":"331efa6eb818ef51915f37caf34f8e0b985f5b17a1464f541e7b793e43a0c176","decodedSHA256":"b288efed40d701119d7602fdf4f06b61a3c08e6be59275e5b0b511fe89fccc23"},"T13":{"id":"T13","style":"CuffBandSkirt","recipeHash":"e6bf5c4164b34fb7d5fb870b47eed00ead1d83121016de56eccda7031fe8f0b1","geometryHash":"3cd72ec069dea0fd05f7b87cd47131bfc7a2ce9dc11f2aca97171adcd40d5afa","decodedSHA256":"aca00a6e44c9c9ca597ef7674ef4db192c1e7c97a0f71232e700553eab8a9604"},"T14":{"id":"T14","style":"Strapless","recipeHash":"d9019332d51c4309c1af7a8061b9ed1cece677d90cceec842fd150c70d3eee0d","geometryHash":"b938a2adbf80a69c0eee03ac60d40614d3134b995b43075e5975846fbd647b3d","decodedSHA256":"ee4fe4f104b7a445d3e1d6e608cdc0d49a504e635e01a5a266ab1a6a2146afc2"},"T15":{"id":"T15","style":"AsymmetricShirt","recipeHash":"a4422d50184572e9f4fbff8ee38bce80b008f4b5e5ab6e3130727edcddfec696","geometryHash":"3192951d5cf416fa5bfcb67438079363ad8d3219706c686ab6861fce1e63cb3d","decodedSHA256":"0a78dd199eeb9dd28d8c21298ee249c4d2d6e75152a0b6563d2f7a30f1975f6b"},"T16":{"id":"T16","style":"Shirt","recipeHash":"b9460b5efb56f032daf9ea59025f96ce27bf075a1010eddc5e16927857335943","geometryHash":"7caa562d757443080c12499fc945ead7b315fe62294200f0812d9412c9107996","decodedSHA256":"bcb5e92dbfe10ecaf40dd080d0bbe68d3802b5ac19b81ca81e1f06cc2e8face0"},"T17":{"id":"T17","style":"Shirt","recipeHash":"dea1248238d98262fed8e2c3933415e7984a0218aa18dcad65c0653d9f3f60ed","geometryHash":"42721c487cfcc1e52ef29cd4b4a3ce5c32badce3a1ebc527bb83f58c53aacae6","decodedSHA256":"6c10949c8c080585857874675dea04a02dc2ea5cabce65116d193ba757a6afcb"},"T18":{"id":"T18","style":"Shirt","recipeHash":"e023669e456f6488869f7bc668014b0aee76e761e4600e1ffec180ebecaf95d7","geometryHash":"69b523f30e6b49035b10954878bbaa23b99699ab32f4fc4234f426a19930904d","decodedSHA256":"6ddf6aae062d5378255b50cafbb5462c989cd9d4cd8b86d8ad7872f15cdd96ef"},"P01":{"id":"P01","style":"Pants","recipeHash":"0d38f3cb9ce793078502a56a5ffb830f380f2f5180b9214f90b104d055ff2895","geometryHash":"5f6d651f5e188cb9fb9a21f007a60c16f15be2d48187acc0d00078018f98c878","decodedSHA256":"f26b9d49480a8cd5a52a24259ca8fdec2e11e997b36fce81e0c6fae78afd4630"},"P02":{"id":"P02","style":"Pants","recipeHash":"39361c076e9972c18c1406a76ba00009259c45f7e79c7426c1e6d009905ba103","geometryHash":"813a597d20de5dd54fa4df1efd6ada7ba85b618fafa6b1e09ecfc61b00ebefa5","decodedSHA256":"ba0666533ecaec09140fc2dc232f8bada3f2d713321c979ca9a60bacf642b73f"},"P03":{"id":"P03","style":"Pants","recipeHash":"8c7385ece948936121a58bc9d8c48efefcbe59e69522a1a8d461668acd9829e7","geometryHash":"da4c771385a94089a498c6171cbc38f8989051a592ff2ed0f40ff4832de0d488","decodedSHA256":"e61d20ce47b8b96b136c248315eb9a503cca63ed2f0f1beb407c2cdfcff2ca36"},"P04":{"id":"P04","style":"Pants","recipeHash":"557f067e72fe3a1cb6a07136a7b673fd6ef9e00030f88302b774d623ad680ee4","geometryHash":"6a130a2cd0d840944e5dea0172d66db896fede07d394b0a84061056ed4941ed0","decodedSHA256":"d1733832c5dffb3c28dd5d08af4b194ee4584df9d7ef1986b99ceeecf0fb49e1"},"P05":{"id":"P05","style":"Pants","recipeHash":"7d973aad39418ea6fd4be3905a5f52b52d5df19ecf68fc376838e00484de3487","geometryHash":"044c8aa35a4ff34c375fc287e165a24776b8d9bc02b7929813582cf95f0937a8","decodedSHA256":"abecc67b00161335320cf1a2c69b09207dc81a8dc3339c7c6de794f3ad56a2c0"},"P06":{"id":"P06","style":"Pants","recipeHash":"20a979737124f629dab8e0e3151e9f27dffa5c5eee2f321bfedb2e257cfedae2","geometryHash":"577d4a41612de1b459979e7d82d1fec7fff334898b4b6aa4ce9abf68852e3ed0","decodedSHA256":"72b5be7408121bbdfeaf6f25b8a09624244411763ccc6ab19182938affd2bf4b"},"P07":{"id":"P07","style":"Pants","recipeHash":"450e3dcb8e27098f711327ea8c6a83a646e1b7caab91eedb71f1f9dc50e2c2ad","geometryHash":"8780d65a08d31630e9cdfdb166c9af5b6a3076bf84e202f8b9c2464f67acc838","decodedSHA256":"6f15eac4991966078a898d94242e1d4d8844c3721ae99beb20f85c28e7e80e79"},"P08":{"id":"P08","style":"StraightWB","recipeHash":"a7a343ff1f70845de2a4c2a4d8e442a52971f2f87931319eaeea22e4068f0117","geometryHash":"b0e11442b3c71893df3f3c5578ac43646e89846d56676fd1111e8332b6fd2c1d","decodedSHA256":"82583c3c1b29d77eb13e13e4cf464a344bbaed780562a4d8086251ec63dd944a"},"P09":{"id":"P09","style":"FittedWB","recipeHash":"ddd2daef5a58965eb6126235f61c41a4f17eaee22e12723c1b8e7e93adea5ffb","geometryHash":"1060bcb279412e605af8bfc964baa782c4d42ec52aebe52304f96ac80422653c","decodedSHA256":"f79771ac1d3b231f754fd9169d4e51a6d7784a75c2286252f181fa34a6afe540"},"P10":{"id":"P10","style":"Pants","recipeHash":"252a53f92789b5918981eb4916ae77af8ac181cd349f22936f1677a6dda7d37f","geometryHash":"1388020c6dc1be17199100f21d07f392c30fd092dceac301869129083ca5b213","decodedSHA256":"8f8a81e6864f62aa6829c510d362c0e8721bcaaed448adeb10b314a03b202d52"},"S01":{"id":"S01","style":"Skirt2","recipeHash":"793a26a6a4dd006eb0ad3ec41e91c7e01249a19ce3fa5653c0c63e8b158f4738","geometryHash":"7d5ca14bef561e5a2d12fd8c0a6d36aca00427d78c586d54fd2fa658fa3e9495","decodedSHA256":"f5847bfde6950f5b2c586cd577423a3ab9baa0f37663deaeacb18cfaa32fabe1"},"S02":{"id":"S02","style":"Skirt2","recipeHash":"145fed9bdef91d43d0b9e625ccafe56a3744ec8f742c045a0395d85ee805e6b9","geometryHash":"d205eb2abe0ef4d34ea3a325dda85fffd1378beeb51f43734792935b3c80aeeb","decodedSHA256":"48ab0269d243ef48c40f5ccd6925323e779ec5cdf61803a36862621deed0bb3c"},"S03":{"id":"S03","style":"PencilSkirt","recipeHash":"0a5b56c44b44192a6d7666da1af31f098b7c92ef382b3dd33f73c42478f5d57d","geometryHash":"5f257229209ce4ba9e57c3c32df02f03899e3462a820169d08c5abf89937f6a1","decodedSHA256":"3e54c6322a46ea7232644f341a4f5ea300d0b20a24a1d45765138b707d753baa"},"S04":{"id":"S04","style":"PencilSkirt","recipeHash":"4e67b20745f926862c29afd56158eb3796826f24df9197cfe77bef6a37147788","geometryHash":"062e9ba0933b4130098d9f470835a4cebd3c6b67a286a187eeaf9053c75c0ea3","decodedSHA256":"de6f3818a83b44e3303323d76c75eded0019135cca6ad131d6e92505f2983bc6"},"S05":{"id":"S05","style":"SkirtCircle","recipeHash":"92023b011579db83e7b175f1d66c573d2b7ac346748244989a6718e4ada72fe0","geometryHash":"a882f394acfc7c4d5bf9e79e2681f1e2b2fa11afaec8df4e19a3074ff984440a","decodedSHA256":"1fccad9e7ee9453fbede7a4517700778706937063ea5ee49a6bcf0322787b56f"},"S06":{"id":"S06","style":"SkirtCircle","recipeHash":"20a8570cb4e92f90de09b4a8efe1583cafc5e4e9aca49f2db06375cf48a66137","geometryHash":"e2652ec6c8fa0e11b9959a70bcf97bf488e8d71c6c5807947e6f93b6e27d9a01","decodedSHA256":"7689f6e0853ca87dbc38199b64c1720d06b8bfc6afc021deb76b93debc500d94"},"S07":{"id":"S07","style":"AsymmSkirtCircle","recipeHash":"8474be112f308b5f785d458d5e903d0fe82a825df585e18d5ba2691559b068df","geometryHash":"6f3cde5b9525311c29eb2019ceb57bc434ff56fa099d6cb607ea51e2c45ca351","decodedSHA256":"659f1b1f60279091569ed4ba6432f29f2df6586d0c4a7f0840f6b3e5451a0df7"},"S08":{"id":"S08","style":"SkirtManyPanels","recipeHash":"ba6f06103d588622ec9132b1ae0bb3d802d4dea0e7bb2830ef18bb5d1e6bbc28","geometryHash":"ab1dae4b64337b288337f2838b609010c44492aa65b288c046d0eab2da69ee4c","decodedSHA256":"509c1fbead8f2da05dca37ecd2a969e323096a52bf663fb39de4880121253162"},"S09":{"id":"S09","style":"SkirtManyPanels","recipeHash":"39875fd32eb1d2a2e4b63b16ef414383d0643b738587b13a9b6cebbf849246bf","geometryHash":"89ce3211e5a932908569bad8b969a2c534616cb2459d05b042020dd45576ad4d","decodedSHA256":"887ac48c6def8aaccf05e24365a8f87c9b44c791b273c949ee41ff2c03ff5aa5"},"S10":{"id":"S10","style":"GodetSkirt","recipeHash":"e16acd628b4a71d90801c4c91874df65b0265f5e82c24a402522a019003e9956","geometryHash":"cd91291024c96d6b3b7bc0a332834d35c2cb3506c8db235e7d36b1e8df70eef8","decodedSHA256":"9a658ea8bef445f559992b1988bac5157983e3ca25d56454f45c35a132f0c63f"},"S11":{"id":"S11","style":"SkirtLevels","recipeHash":"ce528250fca15d8ef46fb37f4aabdac10ffc7f7c33ec3aded972d169e99bb015","geometryHash":"682adbd38db55bb5da35d30c338598c161748a4c5141e53a0b4d0e5f9f14fd54","decodedSHA256":"4ef8034c4a3a6f0a75e56d21ed0c790ca95397dc679ce04e0ea868d891605dae"},"S12":{"id":"S12","style":"SkirtLevels","recipeHash":"f578b4a49bc119a5c24dfb4bf4d885f443bcf468c9d7572ce433af5f74b191e0","geometryHash":"8edc1d2041e8347cb53d9f6ca17346a52fb6d6bd00781107ffa3148a4a4e3b04","decodedSHA256":"6c54807564863de8c548ce895f4436a22591f5154015d9cd56a00512eb6ba4d4"},"S13":{"id":"S13","style":"SkirtCircle","recipeHash":"6ba31bfb1da95dee96786bf11ae38939a3d41bf1fc8eeb9e67626d7fdcc75312","geometryHash":"ba99e525e492237e70d0f6561bfcdab9849eded14bb266ac8d3540264a3dcd72","decodedSHA256":"2ac18e1791101b442a9ab9e3980897484d1d971cb48b7f0bc25a19e11c404e52"},"S14":{"id":"S14","style":"PencilSkirt","recipeHash":"748ad9ce508d2cb7b63e4239062b2a32c5eb8fad12975d575ff60eb1f2c7bb09","geometryHash":"4dd8a30a5e65f50582491686e2da57c683f8acc79cd25652d138e1ed3a3eea7b","decodedSHA256":"42ff4f1635ab15d2b98b7f100c5d6c20e25791a1ac4485fed7aeb2ceb7026535"},"D01":{"id":"D01","style":"MetaGarmentDress","recipeHash":"0c80e8e44b21f6e07bf4bbeca8c01efea3a9500e4eb435c290d7fdac06cd56e2","geometryHash":"4ff2afaf28f5496064dc477921aace7b15db92d7aa3de08f85a5df5662db0e22","decodedSHA256":"0303a022174a43e296c3edca4fa3ae874ac9206ec636be353b6ccd3507055cc8"},"D02":{"id":"D02","style":"MetaGarmentDress","recipeHash":"31bc770c58a86ca33ab2506cb6aee12c1ed7a894d4a38cfcba29e02d996335d6","geometryHash":"d4c4d65fafc4d142ba1dca97e93061e431a8a2452494978df0eb80846069d5e3","decodedSHA256":"0d156ada97c4884be4c363ba0d29aec1d7acfd2e57954a23a1faa2c4f2f85440"},"D03":{"id":"D03","style":"MetaGarmentDress","recipeHash":"a903ec66885fc3775167f22025e1ee5ec418f2a5eaf7b6a41eddf282505b3411","geometryHash":"5170d127dbaa160ca0e78158f738ead092b2686b1df421cabcdb42e6556d89a8","decodedSHA256":"9e36c3e81a7500a1fccff7d6ac8c937c0f171897a45401fe3ddbf727cddf2742"},"D04":{"id":"D04","style":"MetaGarmentDress","recipeHash":"ce655ede533b3a03dd041a60220f2a6b11c5de0fc572a3dd21fc39db62f6b86b","geometryHash":"f347cbeeffb1fa0dec2854c3e0265d5b7c6385c8b8e20a9acba4aae4afcf0c6d","decodedSHA256":"a1904e45f630deaac4bc1915c78f0f81b46fb7c36faecdb5967ba2f95d74a604"},"D05":{"id":"D05","style":"MetaGarmentDress","recipeHash":"d03a48e6bf33013cc80ffe530dbfd7800686bf3e624bdb1d9535697a4f0ef365","geometryHash":"b1f913e2ca52635242fc3813865e95771ccd749d588b0e6c2e6bda2bafd77057","decodedSHA256":"1b00f4aeb9ad4a9daa480e4ada6cf6c158718a52d5ce99de457d1c09a275048e"},"D06":{"id":"D06","style":"MetaGarmentDress","recipeHash":"de059d91eea739483e35a831420450de342ac536558059bbc1321cf2c913b985","geometryHash":"4edd8697c1f2e053f7d46e4241ead47c26eb775e8adac71fd224a5fa4e67e99d","decodedSHA256":"6b77fe3402ea08441386ea6b9b0c18092b26d657f0599d3b7531d9ad0fc6d694"},"D07":{"id":"D07","style":"MetaGarmentDress","recipeHash":"a818f277d38ef8937216ed45339d07323793dfa8fee93ed98eb945323ca6968a","geometryHash":"5b6369639e13dc5c1ad271c49f5f59e0c1c5658b2c572ddc24a925a62f2862dc","decodedSHA256":"910c5b827a29f6e2ea1e2d4e6a8f5ff3923cef4cefa661c09e371ba39adae498"},"D08":{"id":"D08","style":"MetaGarmentDress","recipeHash":"c6ff9132efc1a062b74d5cb75190146d8767cefe1d0f752983c6396417423cca","geometryHash":"6b92abd9db8f174750f5119d5486c533e65f1b5da1d480f2ee300dcedd55c3f3","decodedSHA256":"bde13dd97f499920e539390763431f8a723e992ecbde6d75db4b52ee55cb5fc8"},"D09":{"id":"D09","style":"MetaGarmentDress","recipeHash":"d72ade61e1c360f397ce0433c3b715ae15d8e1cdb439e29d54dc2262072131ce","geometryHash":"365863e1c611577ef9025bb2541345e5f3f43b00979cf51bcc6d71bd14c79af2","decodedSHA256":"c213e7fd8505c24d485e0a3ef264fa0df73110278a3111b1c4328d0a1f08b975"},"D10":{"id":"D10","style":"MetaGarmentDress","recipeHash":"a6d404020a7427aa7dd51568676670d0112eb3c69bb573c3a3c72328e9ccf277","geometryHash":"c630b62a9b8067c4f879919e42fd2e373f902246b95557523fc7c0df0f5c57cc","decodedSHA256":"70a0083f8e2ae65507a0ff20e3ac7ec4bd868582aa67978146072b07c04c2812"},"D11":{"id":"D11","style":"MetaGarmentDress","recipeHash":"2aa965ef8e8cc454eca9b549c249f73e6acd6c6b01a4363b71c88137d1e3fd3d","geometryHash":"d2f97e3cf83828bec998c0799d96757b2a083a669652c4a2391889e7bf3c3f4d","decodedSHA256":"1565e62c7da7b5543eeb863529bec2d3a4e64816850ac1bbcdcedd2bc190d70f"},"D12":{"id":"D12","style":"MetaGarmentDress","recipeHash":"7eb5ce62c1482fd29712183276d95d9a56da75a9af63c645e92d91d6d1c63bd8","geometryHash":"5c90b03c49651c69852a8574be13a86776983ef677f63d9ef4e5c76cf45f60b7","decodedSHA256":"e875407fdec2cbe6b19dc6194cd5245ad964976eda230df6bb02b3f5526d7686"},"J01":{"id":"J01","style":"MetaGarmentJumpsuit","recipeHash":"7b0e0416ce1d1521213ced08feba8d74e6f6fa98017829b38ed5630c82251af0","geometryHash":"b170a53d8ee43c9ce677546cbb66ce7974d983a5804a790b44d093ca67a3f012","decodedSHA256":"bc195f532919c4161c3a775a7c9776d4342c4cee151735c1d223871b6b0a7072"},"J02":{"id":"J02","style":"MetaGarmentJumpsuit","recipeHash":"089d7db169e4dfda1c28a204bd8481321a232714b97b3cb2b5a1e706d7b00d1e","geometryHash":"7977ccaff7d835aa6ac0f3c159fb138aa71c9139e65f146a16007e20348ef51b","decodedSHA256":"80dbc134bfd0b87a33076abde57b3301a7b14e2d52321662de95c02f9d8362e6"},"J03":{"id":"J03","style":"MetaGarmentJumpsuit","recipeHash":"729ace650b1a17d31f6bd29de07e2909593dd1c74ebf96292cb634523da632ab","geometryHash":"5d1ba167921e425eaaeec17de1bbabca5fc6ca61b71b5654738c3cf31f398f73","decodedSHA256":"77dfb6c71ffdf25bbd3febb7fb3ce5abd5a08beb08ffbd271a88b3b5a0ac7078"},"J04":{"id":"J04","style":"MetaGarmentJumpsuit","recipeHash":"f177dee8153230ce6b3d9c5e320133c9faa107c0ab4accd85457e0c54caef178","geometryHash":"651144862c9060d06cb1bf223235f746dd95ccf17af8acbd1a5c138732a05174","decodedSHA256":"de86d88f933de146c4ec924bc92cfbc22790cc1b8502c07b85e4698556a73d31"},"J05":{"id":"J05","style":"MetaGarmentJumpsuit","recipeHash":"44694db4c85a40a4b2fb3a8ba638009639a2dc29c524fe38ac7308ca4c07e6ad","geometryHash":"e6db01946a0e44978afd34d872858c57ceb20becd208856e51ad75366a41f8a3","decodedSHA256":"409d09c7af19ccb238d4533a45c6163b255f677920533ce0d8eb6b5a00aff026"},"J06":{"id":"J06","style":"MetaGarmentJumpsuit","recipeHash":"772c1671ebda7c7b212087407e3a5a27c9bc4c2e22e9a37d0f829dca2311d511","geometryHash":"e4b0b83892aeb8ebaa89c2a8e08c763a6d3b5353cb9bb70a6f3b1aac604bc544","decodedSHA256":"f9918ae62c937b09f1707880ffcc5696bfebb6b98f2cee2d47c3105809e65fa1"}};
var nativeBinding=null;
const nativeAssets=new URL('../../../assets/',import.meta.url);
async function nativeJSON(url,expected){const r=await fetch(url);if(!r.ok)throw Error('原系统输入读取失败 '+r.status);const b=await r.arrayBuffer();if(await sha(b)!==expected)throw Error('原系统输入文件版本不符');return JSON.parse(new TextDecoder().decode(b));}
async function loadNativePaper(data){
 stop();requestId=data.requestId;nativeBinding=null;spec=analytic=lab=null;resetContinuation();
 requirePerson(data.person,R04_LOCK.person);
 const row=R04_ROWS[data.presetId];if(!row)throw Error('未知原始纸样 ID');
 if(await sha(data.paperText)!==row.decodedSHA256)throw Error('原纸样内容哈希不符');
 const original=JSON.parse(data.paperText);if(original.recipeHash!==row.recipeHash||original.geometryHash!==row.geometryHash||!original.validation?.analytic2DPass)throw Error('原裁片身份不符');
 for(const key in profile)profile[key]=0;
 const token=epoch;analytic=await recoverExplicitPantsCuffGathering(prepareNativeSource(original));if(token!==epoch)return;
 config={kind:'analytic',recipe:{bodyCm:structuredClone(original.bodyCm),design:{...structuredClone(original.design),style:row.style}}};
 const start=performance.now();spec=compileWithinNativeBudget(analytic,{allowUnsupportedSeams:true,numericalStitchSpacingMm:12,measurementSnapshot:{bodyId:'common-native-default-r04',sizingOrigin:'original-reference-paper-not-remeasured'}});
 spec.source.bodyId='common-native-default-r04';spec.source.patternSizingOrigin=R04_LOCK.sizingPolicy;
 validate2(spec);profile.meshMs=performance.now()-start;
 nativeBinding={person:structuredClone(R04_LOCK.person),presetId:row.id,recipeHash:row.recipeHash,paperSHA256:row.decodedSHA256,materialSHA256:await materialHash(spec),nativeAnchor:R04_LOCK.nativeAnchor,patternSizingOrigin:R04_LOCK.sizingPolicy};
 spec.source.nativeBinding=structuredClone(nativeBinding);
 const positionsM=initialPositions(spec),fit=preflightSizing(analytic);
 emit('paper',{spec,analytic,positionsM,fingerprint:fingerprint2(spec),topology:topology(spec),profile,fitPreflight:fit,canSew:!fit.blocking,physicalStatus:'原尺码纸样已原生重网格；尚未缝合，不是合格成衣'},[positionsM.buffer]);
}
import {preflightSizing} from '../r07/stability/fit-preflight.mjs';
import {requiresGatheredStitchSites} from '../r07/stability/gathering.mjs';
import {beginJointRefinement,finalizeCloseSeams,jointReport} from '../r07/stability/refinement.mjs';
import {coplanarPositiveOverlap} from '../r07/stability/audit.mjs';
import {continuationStaticGate as staticGate} from '../r07/continuation/seam-gate.mjs';
import {recoverExplicitPantsCuffGathering} from '../r07/continuation/cuff-gathering.mjs';
import {createSeamLayerGuide} from '../r07/assembly.mjs';
import {prepareContinuationAssembly as prepareAssembly} from '../r07/continuation/assembly.mjs';
// R06.2 additive worker. Original catalogue/workbench-worker.bundle.mjs remains intact.
// Temporary assembly fixtures derived from the original shoulder seams and exact-body SDF.
// Never modifies UVs, triangles, analytic curves, body geometry, or permanent constraints.
function prepareShoulderFixtures(spec,sdf){
 const panels=new Map(spec.panels.map(p=>[p.id,p]));const q=new Float64Array(5);let count=0;
 const world=(p,id)=>{const [u,v]=p.uvMm[id],b=p.placement.rigidBasis,t=p.placement.translationMm;return[(b[0]*u+b[1]*v+t[0])/1000,(b[3]*u+b[4]*v+t[1])/1000,(b[6]*u+b[7]*v+t[2])/1000];};
 for(const seam of spec.seams.filter(s=>s.stageId==='shoulders')){
  const a=panels.get(seam.a.panelId),b=panels.get(seam.b.panelId),pairs=seam.stitchVertexPairs;
  if(!a||!b||!pairs?.length)continue;
  const endpoints=[pairs[0],pairs.at(-1)];
  const pair=endpoints.sort((p1,p2)=>Math.abs(world(a,p2[0])[0])-Math.abs(world(a,p1[0])[0]))[0];
  const pa=world(a,pair[0]),pb=world(b,pair[1]);const x=(pa[0]+pb[0])/2,z=.008860204985917;
  // This Z slice is the existing Anny acromion surface landmark plane, not a replacement body.
  let previous=sdf.sample(x,1.68,z,q)[0],hit=null;
  for(let y=1.678;y>1.36;y-=.002){const d=sdf.sample(x,y,z,q)[0];if(previous>=.004&&d<.004){let lo=y,upper=y+.002;for(let j=0;j<18;j++){const mid=(lo+upper)/2;if(sdf.sample(x,mid,z,q)[0]<.004)lo=mid;else upper=mid;}hit=[x,(lo+upper)/2,z];break;}previous=d;}
  if(!hit)continue;
  for(const [p,id,side]of[[a,pair[0],1],[b,pair[1],-1]]){
   if(!p.temporaryPins.includes(id))p.temporaryPins.push(id);
   p.temporaryPinTargetsMm[id]=hit.map((v,k)=>v*1000+(k===2?side*.4:0));count++;
  }
 }
 spec.source.temporaryFixturePlan={count,method:'outer endpoints of original shoulder seams; upward full-body-SDF contact in recorded Anny acromion Z plane',releasedBeforeGravity:true,doesNotAlterRestMaterial:true};
 return count;
}

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// tailor-unify-20261007/toolchain/node_modules/binary-search-bounds/search-bounds.js
var require_search_bounds = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/binary-search-bounds/search-bounds.js"(exports, module2) {
    "use strict";
    function ge(a, y, c, l, h) {
      var i = h + 1;
      while (l <= h) {
        var m = l + h >>> 1, x = a[m];
        var p = c !== void 0 ? c(x, y) : x - y;
        if (p >= 0) {
          i = m;
          h = m - 1;
        } else {
          l = m + 1;
        }
      }
      return i;
    }
    function gt(a, y, c, l, h) {
      var i = h + 1;
      while (l <= h) {
        var m = l + h >>> 1, x = a[m];
        var p = c !== void 0 ? c(x, y) : x - y;
        if (p > 0) {
          i = m;
          h = m - 1;
        } else {
          l = m + 1;
        }
      }
      return i;
    }
    function lt(a, y, c, l, h) {
      var i = l - 1;
      while (l <= h) {
        var m = l + h >>> 1, x = a[m];
        var p = c !== void 0 ? c(x, y) : x - y;
        if (p < 0) {
          i = m;
          l = m + 1;
        } else {
          h = m - 1;
        }
      }
      return i;
    }
    function le(a, y, c, l, h) {
      var i = l - 1;
      while (l <= h) {
        var m = l + h >>> 1, x = a[m];
        var p = c !== void 0 ? c(x, y) : x - y;
        if (p <= 0) {
          i = m;
          l = m + 1;
        } else {
          h = m - 1;
        }
      }
      return i;
    }
    function eq(a, y, c, l, h) {
      while (l <= h) {
        var m = l + h >>> 1, x = a[m];
        var p = c !== void 0 ? c(x, y) : x - y;
        if (p === 0) {
          return m;
        }
        if (p <= 0) {
          l = m + 1;
        } else {
          h = m - 1;
        }
      }
      return -1;
    }
    function norm(a, y, c, l, h, f) {
      if (typeof c === "function") {
        return f(a, y, c, l === void 0 ? 0 : l | 0, h === void 0 ? a.length - 1 : h | 0);
      }
      return f(a, y, void 0, c === void 0 ? 0 : c | 0, l === void 0 ? a.length - 1 : l | 0);
    }
    module2.exports = {
      ge: function(a, y, c, l, h) {
        return norm(a, y, c, l, h, ge);
      },
      gt: function(a, y, c, l, h) {
        return norm(a, y, c, l, h, gt);
      },
      lt: function(a, y, c, l, h) {
        return norm(a, y, c, l, h, lt);
      },
      le: function(a, y, c, l, h) {
        return norm(a, y, c, l, h, le);
      },
      eq: function(a, y, c, l, h) {
        return norm(a, y, c, l, h, eq);
      }
    };
  }
});

// tailor-unify-20261007/toolchain/node_modules/two-product/two-product.js
var require_two_product = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/two-product/two-product.js"(exports, module2) {
    "use strict";
    module2.exports = twoProduct;
    var SPLITTER = +(Math.pow(2, 27) + 1);
    function twoProduct(a, b, result) {
      var x = a * b;
      var c = SPLITTER * a;
      var abig = c - a;
      var ahi = c - abig;
      var alo = a - ahi;
      var d = SPLITTER * b;
      var bbig = d - b;
      var bhi = d - bbig;
      var blo = b - bhi;
      var err1 = x - ahi * bhi;
      var err2 = err1 - alo * bhi;
      var err3 = err2 - ahi * blo;
      var y = alo * blo - err3;
      if (result) {
        result[0] = y;
        result[1] = x;
        return result;
      }
      return [y, x];
    }
  }
});

// tailor-unify-20261007/toolchain/node_modules/robust-sum/robust-sum.js
var require_robust_sum = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/robust-sum/robust-sum.js"(exports, module2) {
    "use strict";
    module2.exports = linearExpansionSum;
    function scalarScalar(a, b) {
      var x = a + b;
      var bv = x - a;
      var av = x - bv;
      var br = b - bv;
      var ar = a - av;
      var y = ar + br;
      if (y) {
        return [y, x];
      }
      return [x];
    }
    function linearExpansionSum(e, f) {
      var ne = e.length | 0;
      var nf = f.length | 0;
      if (ne === 1 && nf === 1) {
        return scalarScalar(e[0], f[0]);
      }
      var n = ne + nf;
      var g = new Array(n);
      var count = 0;
      var eptr = 0;
      var fptr = 0;
      var abs = Math.abs;
      var ei = e[eptr];
      var ea = abs(ei);
      var fi = f[fptr];
      var fa = abs(fi);
      var a, b;
      if (ea < fa) {
        b = ei;
        eptr += 1;
        if (eptr < ne) {
          ei = e[eptr];
          ea = abs(ei);
        }
      } else {
        b = fi;
        fptr += 1;
        if (fptr < nf) {
          fi = f[fptr];
          fa = abs(fi);
        }
      }
      if (eptr < ne && ea < fa || fptr >= nf) {
        a = ei;
        eptr += 1;
        if (eptr < ne) {
          ei = e[eptr];
          ea = abs(ei);
        }
      } else {
        a = fi;
        fptr += 1;
        if (fptr < nf) {
          fi = f[fptr];
          fa = abs(fi);
        }
      }
      var x = a + b;
      var bv = x - a;
      var y = b - bv;
      var q0 = y;
      var q1 = x;
      var _x, _bv, _av, _br, _ar;
      while (eptr < ne && fptr < nf) {
        if (ea < fa) {
          a = ei;
          eptr += 1;
          if (eptr < ne) {
            ei = e[eptr];
            ea = abs(ei);
          }
        } else {
          a = fi;
          fptr += 1;
          if (fptr < nf) {
            fi = f[fptr];
            fa = abs(fi);
          }
        }
        b = q0;
        x = a + b;
        bv = x - a;
        y = b - bv;
        if (y) {
          g[count++] = y;
        }
        _x = q1 + x;
        _bv = _x - q1;
        _av = _x - _bv;
        _br = x - _bv;
        _ar = q1 - _av;
        q0 = _ar + _br;
        q1 = _x;
      }
      while (eptr < ne) {
        a = ei;
        b = q0;
        x = a + b;
        bv = x - a;
        y = b - bv;
        if (y) {
          g[count++] = y;
        }
        _x = q1 + x;
        _bv = _x - q1;
        _av = _x - _bv;
        _br = x - _bv;
        _ar = q1 - _av;
        q0 = _ar + _br;
        q1 = _x;
        eptr += 1;
        if (eptr < ne) {
          ei = e[eptr];
        }
      }
      while (fptr < nf) {
        a = fi;
        b = q0;
        x = a + b;
        bv = x - a;
        y = b - bv;
        if (y) {
          g[count++] = y;
        }
        _x = q1 + x;
        _bv = _x - q1;
        _av = _x - _bv;
        _br = x - _bv;
        _ar = q1 - _av;
        q0 = _ar + _br;
        q1 = _x;
        fptr += 1;
        if (fptr < nf) {
          fi = f[fptr];
        }
      }
      if (q0) {
        g[count++] = q0;
      }
      if (q1) {
        g[count++] = q1;
      }
      if (!count) {
        g[count++] = 0;
      }
      g.length = count;
      return g;
    }
  }
});

// tailor-unify-20261007/toolchain/node_modules/two-sum/two-sum.js
var require_two_sum = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/two-sum/two-sum.js"(exports, module2) {
    "use strict";
    module2.exports = fastTwoSum;
    function fastTwoSum(a, b, result) {
      var x = a + b;
      var bv = x - a;
      var av = x - bv;
      var br = b - bv;
      var ar = a - av;
      if (result) {
        result[0] = ar + br;
        result[1] = x;
        return result;
      }
      return [ar + br, x];
    }
  }
});

// tailor-unify-20261007/toolchain/node_modules/robust-scale/robust-scale.js
var require_robust_scale = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/robust-scale/robust-scale.js"(exports, module2) {
    "use strict";
    var twoProduct = require_two_product();
    var twoSum = require_two_sum();
    module2.exports = scaleLinearExpansion;
    function scaleLinearExpansion(e, scale) {
      var n = e.length;
      if (n === 1) {
        var ts = twoProduct(e[0], scale);
        if (ts[0]) {
          return ts;
        }
        return [ts[1]];
      }
      var g = new Array(2 * n);
      var q = [0.1, 0.1];
      var t = [0.1, 0.1];
      var count = 0;
      twoProduct(e[0], scale, q);
      if (q[0]) {
        g[count++] = q[0];
      }
      for (var i = 1; i < n; ++i) {
        twoProduct(e[i], scale, t);
        var pq = q[1];
        twoSum(pq, t[0], q);
        if (q[0]) {
          g[count++] = q[0];
        }
        var a = t[1];
        var b = q[1];
        var x = a + b;
        var bv = x - a;
        var y = b - bv;
        q[1] = x;
        if (y) {
          g[count++] = y;
        }
      }
      if (q[1]) {
        g[count++] = q[1];
      }
      if (count === 0) {
        g[count++] = 0;
      }
      g.length = count;
      return g;
    }
  }
});

// tailor-unify-20261007/toolchain/node_modules/robust-subtract/robust-diff.js
var require_robust_diff = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/robust-subtract/robust-diff.js"(exports, module2) {
    "use strict";
    module2.exports = robustSubtract;
    function scalarScalar(a, b) {
      var x = a + b;
      var bv = x - a;
      var av = x - bv;
      var br = b - bv;
      var ar = a - av;
      var y = ar + br;
      if (y) {
        return [y, x];
      }
      return [x];
    }
    function robustSubtract(e, f) {
      var ne = e.length | 0;
      var nf = f.length | 0;
      if (ne === 1 && nf === 1) {
        return scalarScalar(e[0], -f[0]);
      }
      var n = ne + nf;
      var g = new Array(n);
      var count = 0;
      var eptr = 0;
      var fptr = 0;
      var abs = Math.abs;
      var ei = e[eptr];
      var ea = abs(ei);
      var fi = -f[fptr];
      var fa = abs(fi);
      var a, b;
      if (ea < fa) {
        b = ei;
        eptr += 1;
        if (eptr < ne) {
          ei = e[eptr];
          ea = abs(ei);
        }
      } else {
        b = fi;
        fptr += 1;
        if (fptr < nf) {
          fi = -f[fptr];
          fa = abs(fi);
        }
      }
      if (eptr < ne && ea < fa || fptr >= nf) {
        a = ei;
        eptr += 1;
        if (eptr < ne) {
          ei = e[eptr];
          ea = abs(ei);
        }
      } else {
        a = fi;
        fptr += 1;
        if (fptr < nf) {
          fi = -f[fptr];
          fa = abs(fi);
        }
      }
      var x = a + b;
      var bv = x - a;
      var y = b - bv;
      var q0 = y;
      var q1 = x;
      var _x, _bv, _av, _br, _ar;
      while (eptr < ne && fptr < nf) {
        if (ea < fa) {
          a = ei;
          eptr += 1;
          if (eptr < ne) {
            ei = e[eptr];
            ea = abs(ei);
          }
        } else {
          a = fi;
          fptr += 1;
          if (fptr < nf) {
            fi = -f[fptr];
            fa = abs(fi);
          }
        }
        b = q0;
        x = a + b;
        bv = x - a;
        y = b - bv;
        if (y) {
          g[count++] = y;
        }
        _x = q1 + x;
        _bv = _x - q1;
        _av = _x - _bv;
        _br = x - _bv;
        _ar = q1 - _av;
        q0 = _ar + _br;
        q1 = _x;
      }
      while (eptr < ne) {
        a = ei;
        b = q0;
        x = a + b;
        bv = x - a;
        y = b - bv;
        if (y) {
          g[count++] = y;
        }
        _x = q1 + x;
        _bv = _x - q1;
        _av = _x - _bv;
        _br = x - _bv;
        _ar = q1 - _av;
        q0 = _ar + _br;
        q1 = _x;
        eptr += 1;
        if (eptr < ne) {
          ei = e[eptr];
        }
      }
      while (fptr < nf) {
        a = fi;
        b = q0;
        x = a + b;
        bv = x - a;
        y = b - bv;
        if (y) {
          g[count++] = y;
        }
        _x = q1 + x;
        _bv = _x - q1;
        _av = _x - _bv;
        _br = x - _bv;
        _ar = q1 - _av;
        q0 = _ar + _br;
        q1 = _x;
        fptr += 1;
        if (fptr < nf) {
          fi = -f[fptr];
        }
      }
      if (q0) {
        g[count++] = q0;
      }
      if (q1) {
        g[count++] = q1;
      }
      if (!count) {
        g[count++] = 0;
      }
      g.length = count;
      return g;
    }
  }
});

// tailor-unify-20261007/toolchain/node_modules/robust-orientation/orientation.js
var require_orientation = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/robust-orientation/orientation.js"(exports, module2) {
    "use strict";
    var twoProduct = require_two_product();
    var robustSum = require_robust_sum();
    var robustScale = require_robust_scale();
    var robustSubtract = require_robust_diff();
    var NUM_EXPAND = 5;
    var EPSILON = 11102230246251565e-32;
    var ERRBOUND3 = (3 + 16 * EPSILON) * EPSILON;
    var ERRBOUND4 = (7 + 56 * EPSILON) * EPSILON;
    function orientation_3(sum, prod, scale, sub3) {
      return function orientation3Exact2(m0, m1, m2) {
        var p = sum(sum(prod(m1[1], m2[0]), prod(-m2[1], m1[0])), sum(prod(m0[1], m1[0]), prod(-m1[1], m0[0])));
        var n = sum(prod(m0[1], m2[0]), prod(-m2[1], m0[0]));
        var d = sub3(p, n);
        return d[d.length - 1];
      };
    }
    function orientation_4(sum, prod, scale, sub3) {
      return function orientation4Exact2(m0, m1, m2, m3) {
        var p = sum(sum(scale(sum(prod(m2[1], m3[0]), prod(-m3[1], m2[0])), m1[2]), sum(scale(sum(prod(m1[1], m3[0]), prod(-m3[1], m1[0])), -m2[2]), scale(sum(prod(m1[1], m2[0]), prod(-m2[1], m1[0])), m3[2]))), sum(scale(sum(prod(m1[1], m3[0]), prod(-m3[1], m1[0])), m0[2]), sum(scale(sum(prod(m0[1], m3[0]), prod(-m3[1], m0[0])), -m1[2]), scale(sum(prod(m0[1], m1[0]), prod(-m1[1], m0[0])), m3[2]))));
        var n = sum(sum(scale(sum(prod(m2[1], m3[0]), prod(-m3[1], m2[0])), m0[2]), sum(scale(sum(prod(m0[1], m3[0]), prod(-m3[1], m0[0])), -m2[2]), scale(sum(prod(m0[1], m2[0]), prod(-m2[1], m0[0])), m3[2]))), sum(scale(sum(prod(m1[1], m2[0]), prod(-m2[1], m1[0])), m0[2]), sum(scale(sum(prod(m0[1], m2[0]), prod(-m2[1], m0[0])), -m1[2]), scale(sum(prod(m0[1], m1[0]), prod(-m1[1], m0[0])), m2[2]))));
        var d = sub3(p, n);
        return d[d.length - 1];
      };
    }
    function orientation_5(sum, prod, scale, sub3) {
      return function orientation5Exact(m0, m1, m2, m3, m4) {
        var p = sum(sum(sum(scale(sum(scale(sum(prod(m3[1], m4[0]), prod(-m4[1], m3[0])), m2[2]), sum(scale(sum(prod(m2[1], m4[0]), prod(-m4[1], m2[0])), -m3[2]), scale(sum(prod(m2[1], m3[0]), prod(-m3[1], m2[0])), m4[2]))), m1[3]), sum(scale(sum(scale(sum(prod(m3[1], m4[0]), prod(-m4[1], m3[0])), m1[2]), sum(scale(sum(prod(m1[1], m4[0]), prod(-m4[1], m1[0])), -m3[2]), scale(sum(prod(m1[1], m3[0]), prod(-m3[1], m1[0])), m4[2]))), -m2[3]), scale(sum(scale(sum(prod(m2[1], m4[0]), prod(-m4[1], m2[0])), m1[2]), sum(scale(sum(prod(m1[1], m4[0]), prod(-m4[1], m1[0])), -m2[2]), scale(sum(prod(m1[1], m2[0]), prod(-m2[1], m1[0])), m4[2]))), m3[3]))), sum(scale(sum(scale(sum(prod(m2[1], m3[0]), prod(-m3[1], m2[0])), m1[2]), sum(scale(sum(prod(m1[1], m3[0]), prod(-m3[1], m1[0])), -m2[2]), scale(sum(prod(m1[1], m2[0]), prod(-m2[1], m1[0])), m3[2]))), -m4[3]), sum(scale(sum(scale(sum(prod(m3[1], m4[0]), prod(-m4[1], m3[0])), m1[2]), sum(scale(sum(prod(m1[1], m4[0]), prod(-m4[1], m1[0])), -m3[2]), scale(sum(prod(m1[1], m3[0]), prod(-m3[1], m1[0])), m4[2]))), m0[3]), scale(sum(scale(sum(prod(m3[1], m4[0]), prod(-m4[1], m3[0])), m0[2]), sum(scale(sum(prod(m0[1], m4[0]), prod(-m4[1], m0[0])), -m3[2]), scale(sum(prod(m0[1], m3[0]), prod(-m3[1], m0[0])), m4[2]))), -m1[3])))), sum(sum(scale(sum(scale(sum(prod(m1[1], m4[0]), prod(-m4[1], m1[0])), m0[2]), sum(scale(sum(prod(m0[1], m4[0]), prod(-m4[1], m0[0])), -m1[2]), scale(sum(prod(m0[1], m1[0]), prod(-m1[1], m0[0])), m4[2]))), m3[3]), sum(scale(sum(scale(sum(prod(m1[1], m3[0]), prod(-m3[1], m1[0])), m0[2]), sum(scale(sum(prod(m0[1], m3[0]), prod(-m3[1], m0[0])), -m1[2]), scale(sum(prod(m0[1], m1[0]), prod(-m1[1], m0[0])), m3[2]))), -m4[3]), scale(sum(scale(sum(prod(m2[1], m3[0]), prod(-m3[1], m2[0])), m1[2]), sum(scale(sum(prod(m1[1], m3[0]), prod(-m3[1], m1[0])), -m2[2]), scale(sum(prod(m1[1], m2[0]), prod(-m2[1], m1[0])), m3[2]))), m0[3]))), sum(scale(sum(scale(sum(prod(m2[1], m3[0]), prod(-m3[1], m2[0])), m0[2]), sum(scale(sum(prod(m0[1], m3[0]), prod(-m3[1], m0[0])), -m2[2]), scale(sum(prod(m0[1], m2[0]), prod(-m2[1], m0[0])), m3[2]))), -m1[3]), sum(scale(sum(scale(sum(prod(m1[1], m3[0]), prod(-m3[1], m1[0])), m0[2]), sum(scale(sum(prod(m0[1], m3[0]), prod(-m3[1], m0[0])), -m1[2]), scale(sum(prod(m0[1], m1[0]), prod(-m1[1], m0[0])), m3[2]))), m2[3]), scale(sum(scale(sum(prod(m1[1], m2[0]), prod(-m2[1], m1[0])), m0[2]), sum(scale(sum(prod(m0[1], m2[0]), prod(-m2[1], m0[0])), -m1[2]), scale(sum(prod(m0[1], m1[0]), prod(-m1[1], m0[0])), m2[2]))), -m3[3])))));
        var n = sum(sum(sum(scale(sum(scale(sum(prod(m3[1], m4[0]), prod(-m4[1], m3[0])), m2[2]), sum(scale(sum(prod(m2[1], m4[0]), prod(-m4[1], m2[0])), -m3[2]), scale(sum(prod(m2[1], m3[0]), prod(-m3[1], m2[0])), m4[2]))), m0[3]), scale(sum(scale(sum(prod(m3[1], m4[0]), prod(-m4[1], m3[0])), m0[2]), sum(scale(sum(prod(m0[1], m4[0]), prod(-m4[1], m0[0])), -m3[2]), scale(sum(prod(m0[1], m3[0]), prod(-m3[1], m0[0])), m4[2]))), -m2[3])), sum(scale(sum(scale(sum(prod(m2[1], m4[0]), prod(-m4[1], m2[0])), m0[2]), sum(scale(sum(prod(m0[1], m4[0]), prod(-m4[1], m0[0])), -m2[2]), scale(sum(prod(m0[1], m2[0]), prod(-m2[1], m0[0])), m4[2]))), m3[3]), scale(sum(scale(sum(prod(m2[1], m3[0]), prod(-m3[1], m2[0])), m0[2]), sum(scale(sum(prod(m0[1], m3[0]), prod(-m3[1], m0[0])), -m2[2]), scale(sum(prod(m0[1], m2[0]), prod(-m2[1], m0[0])), m3[2]))), -m4[3]))), sum(sum(scale(sum(scale(sum(prod(m2[1], m4[0]), prod(-m4[1], m2[0])), m1[2]), sum(scale(sum(prod(m1[1], m4[0]), prod(-m4[1], m1[0])), -m2[2]), scale(sum(prod(m1[1], m2[0]), prod(-m2[1], m1[0])), m4[2]))), m0[3]), scale(sum(scale(sum(prod(m2[1], m4[0]), prod(-m4[1], m2[0])), m0[2]), sum(scale(sum(prod(m0[1], m4[0]), prod(-m4[1], m0[0])), -m2[2]), scale(sum(prod(m0[1], m2[0]), prod(-m2[1], m0[0])), m4[2]))), -m1[3])), sum(scale(sum(scale(sum(prod(m1[1], m4[0]), prod(-m4[1], m1[0])), m0[2]), sum(scale(sum(prod(m0[1], m4[0]), prod(-m4[1], m0[0])), -m1[2]), scale(sum(prod(m0[1], m1[0]), prod(-m1[1], m0[0])), m4[2]))), m2[3]), scale(sum(scale(sum(prod(m1[1], m2[0]), prod(-m2[1], m1[0])), m0[2]), sum(scale(sum(prod(m0[1], m2[0]), prod(-m2[1], m0[0])), -m1[2]), scale(sum(prod(m0[1], m1[0]), prod(-m1[1], m0[0])), m2[2]))), -m4[3]))));
        var d = sub3(p, n);
        return d[d.length - 1];
      };
    }
    function orientation(n) {
      var fn = n === 3 ? orientation_3 : n === 4 ? orientation_4 : orientation_5;
      return fn(robustSum, twoProduct, robustScale, robustSubtract);
    }
    var orientation3Exact = orientation(3);
    var orientation4Exact = orientation(4);
    var CACHED = [
      function orientation0() {
        return 0;
      },
      function orientation1() {
        return 0;
      },
      function orientation2(a, b) {
        return b[0] - a[0];
      },
      function orientation3(a, b, c) {
        var l = (a[1] - c[1]) * (b[0] - c[0]);
        var r = (a[0] - c[0]) * (b[1] - c[1]);
        var det = l - r;
        var s;
        if (l > 0) {
          if (r <= 0) {
            return det;
          } else {
            s = l + r;
          }
        } else if (l < 0) {
          if (r >= 0) {
            return det;
          } else {
            s = -(l + r);
          }
        } else {
          return det;
        }
        var tol = ERRBOUND3 * s;
        if (det >= tol || det <= -tol) {
          return det;
        }
        return orientation3Exact(a, b, c);
      },
      function orientation4(a, b, c, d) {
        var adx = a[0] - d[0];
        var bdx = b[0] - d[0];
        var cdx = c[0] - d[0];
        var ady = a[1] - d[1];
        var bdy = b[1] - d[1];
        var cdy = c[1] - d[1];
        var adz = a[2] - d[2];
        var bdz = b[2] - d[2];
        var cdz = c[2] - d[2];
        var bdxcdy = bdx * cdy;
        var cdxbdy = cdx * bdy;
        var cdxady = cdx * ady;
        var adxcdy = adx * cdy;
        var adxbdy = adx * bdy;
        var bdxady = bdx * ady;
        var det = adz * (bdxcdy - cdxbdy) + bdz * (cdxady - adxcdy) + cdz * (adxbdy - bdxady);
        var permanent = (Math.abs(bdxcdy) + Math.abs(cdxbdy)) * Math.abs(adz) + (Math.abs(cdxady) + Math.abs(adxcdy)) * Math.abs(bdz) + (Math.abs(adxbdy) + Math.abs(bdxady)) * Math.abs(cdz);
        var tol = ERRBOUND4 * permanent;
        if (det > tol || -det > tol) {
          return det;
        }
        return orientation4Exact(a, b, c, d);
      }
    ];
    function slowOrient(args) {
      var proc2 = CACHED[args.length];
      if (!proc2) {
        proc2 = CACHED[args.length] = orientation(args.length);
      }
      return proc2.apply(void 0, args);
    }
    function proc(slow, o0, o1, o2, o3, o4, o5) {
      return function getOrientation(a0, a1, a2, a3, a4) {
        switch (arguments.length) {
          case 0:
          case 1:
            return 0;
          case 2:
            return o2(a0, a1);
          case 3:
            return o3(a0, a1, a2);
          case 4:
            return o4(a0, a1, a2, a3);
          case 5:
            return o5(a0, a1, a2, a3, a4);
        }
        var s = new Array(arguments.length);
        for (var i = 0; i < arguments.length; ++i) {
          s[i] = arguments[i];
        }
        return slow(s);
      };
    }
    function generateOrientationProc() {
      while (CACHED.length <= NUM_EXPAND) {
        CACHED.push(orientation(CACHED.length));
      }
      module2.exports = proc.apply(void 0, [slowOrient].concat(CACHED));
      for (var i = 0; i <= NUM_EXPAND; ++i) {
        module2.exports[i] = CACHED[i];
      }
    }
    generateOrientationProc();
  }
});

// tailor-unify-20261007/toolchain/node_modules/cdt2d/lib/monotone.js
var require_monotone = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/cdt2d/lib/monotone.js"(exports, module2) {
    "use strict";
    var bsearch = require_search_bounds();
    var orient = require_orientation()[3];
    var EVENT_POINT = 0;
    var EVENT_END = 1;
    var EVENT_START = 2;
    module2.exports = monotoneTriangulate;
    function PartialHull(a, b, idx, lowerIds, upperIds) {
      this.a = a;
      this.b = b;
      this.idx = idx;
      this.lowerIds = lowerIds;
      this.upperIds = upperIds;
    }
    function Event(a, b, type, idx) {
      this.a = a;
      this.b = b;
      this.type = type;
      this.idx = idx;
    }
    function compareEvent(a, b) {
      var d = a.a[0] - b.a[0] || a.a[1] - b.a[1] || a.type - b.type;
      if (d) {
        return d;
      }
      if (a.type !== EVENT_POINT) {
        d = orient(a.a, a.b, b.b);
        if (d) {
          return d;
        }
      }
      return a.idx - b.idx;
    }
    function testPoint(hull, p) {
      return orient(hull.a, hull.b, p);
    }
    function addPoint(cells, hulls, points, p, idx) {
      var lo = bsearch.lt(hulls, p, testPoint);
      var hi = bsearch.gt(hulls, p, testPoint);
      for (var i = lo; i < hi; ++i) {
        var hull = hulls[i];
        var lowerIds = hull.lowerIds;
        var m = lowerIds.length;
        while (m > 1 && orient(
          points[lowerIds[m - 2]],
          points[lowerIds[m - 1]],
          p
        ) > 0) {
          cells.push(
            [
              lowerIds[m - 1],
              lowerIds[m - 2],
              idx
            ]
          );
          m -= 1;
        }
        lowerIds.length = m;
        lowerIds.push(idx);
        var upperIds = hull.upperIds;
        var m = upperIds.length;
        while (m > 1 && orient(
          points[upperIds[m - 2]],
          points[upperIds[m - 1]],
          p
        ) < 0) {
          cells.push(
            [
              upperIds[m - 2],
              upperIds[m - 1],
              idx
            ]
          );
          m -= 1;
        }
        upperIds.length = m;
        upperIds.push(idx);
      }
    }
    function findSplit(hull, edge) {
      var d;
      if (hull.a[0] < edge.a[0]) {
        d = orient(hull.a, hull.b, edge.a);
      } else {
        d = orient(edge.b, edge.a, hull.a);
      }
      if (d) {
        return d;
      }
      if (edge.b[0] < hull.b[0]) {
        d = orient(hull.a, hull.b, edge.b);
      } else {
        d = orient(edge.b, edge.a, hull.b);
      }
      return d || hull.idx - edge.idx;
    }
    function splitHulls(hulls, points, event) {
      var splitIdx = bsearch.le(hulls, event, findSplit);
      var hull = hulls[splitIdx];
      var upperIds = hull.upperIds;
      var x = upperIds[upperIds.length - 1];
      hull.upperIds = [x];
      hulls.splice(
        splitIdx + 1,
        0,
        new PartialHull(event.a, event.b, event.idx, [x], upperIds)
      );
    }
    function mergeHulls(hulls, points, event) {
      var tmp = event.a;
      event.a = event.b;
      event.b = tmp;
      var mergeIdx = bsearch.eq(hulls, event, findSplit);
      var upper = hulls[mergeIdx];
      var lower = hulls[mergeIdx - 1];
      lower.upperIds = upper.upperIds;
      hulls.splice(mergeIdx, 1);
    }
    function monotoneTriangulate(points, edges) {
      var numPoints = points.length;
      var numEdges = edges.length;
      var events = [];
      for (var i = 0; i < numPoints; ++i) {
        events.push(new Event(
          points[i],
          null,
          EVENT_POINT,
          i
        ));
      }
      for (var i = 0; i < numEdges; ++i) {
        var e = edges[i];
        var a = points[e[0]];
        var b = points[e[1]];
        if (a[0] < b[0]) {
          events.push(
            new Event(a, b, EVENT_START, i),
            new Event(b, a, EVENT_END, i)
          );
        } else if (a[0] > b[0]) {
          events.push(
            new Event(b, a, EVENT_START, i),
            new Event(a, b, EVENT_END, i)
          );
        }
      }
      events.sort(compareEvent);
      var minX = events[0].a[0] - (1 + Math.abs(events[0].a[0])) * Math.pow(2, -52);
      var hull = [new PartialHull([minX, 1], [minX, 0], -1, [], [], [], [])];
      var cells = [];
      for (var i = 0, numEvents = events.length; i < numEvents; ++i) {
        var event = events[i];
        var type = event.type;
        if (type === EVENT_POINT) {
          addPoint(cells, hull, points, event.a, event.idx);
        } else if (type === EVENT_START) {
          splitHulls(hull, points, event);
        } else {
          mergeHulls(hull, points, event);
        }
      }
      return cells;
    }
  }
});

// tailor-unify-20261007/toolchain/node_modules/cdt2d/lib/triangulation.js
var require_triangulation = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/cdt2d/lib/triangulation.js"(exports, module2) {
    "use strict";
    var bsearch = require_search_bounds();
    module2.exports = createTriangulation;
    function Triangulation(stars, edges) {
      this.stars = stars;
      this.edges = edges;
    }
    var proto = Triangulation.prototype;
    function removePair(list, j, k) {
      for (var i = 1, n = list.length; i < n; i += 2) {
        if (list[i - 1] === j && list[i] === k) {
          list[i - 1] = list[n - 2];
          list[i] = list[n - 1];
          list.length = n - 2;
          return;
        }
      }
    }
    proto.isConstraint = /* @__PURE__ */ (function() {
      var e = [0, 0];
      function compareLex(a, b) {
        return a[0] - b[0] || a[1] - b[1];
      }
      return function(i, j) {
        e[0] = Math.min(i, j);
        e[1] = Math.max(i, j);
        return bsearch.eq(this.edges, e, compareLex) >= 0;
      };
    })();
    proto.removeTriangle = function(i, j, k) {
      var stars = this.stars;
      removePair(stars[i], j, k);
      removePair(stars[j], k, i);
      removePair(stars[k], i, j);
    };
    proto.addTriangle = function(i, j, k) {
      var stars = this.stars;
      stars[i].push(j, k);
      stars[j].push(k, i);
      stars[k].push(i, j);
    };
    proto.opposite = function(j, i) {
      var list = this.stars[i];
      for (var k = 1, n = list.length; k < n; k += 2) {
        if (list[k] === j) {
          return list[k - 1];
        }
      }
      return -1;
    };
    proto.flip = function(i, j) {
      var a = this.opposite(i, j);
      var b = this.opposite(j, i);
      this.removeTriangle(i, j, a);
      this.removeTriangle(j, i, b);
      this.addTriangle(i, b, a);
      this.addTriangle(j, a, b);
    };
    proto.edges = function() {
      var stars = this.stars;
      var result = [];
      for (var i = 0, n = stars.length; i < n; ++i) {
        var list = stars[i];
        for (var j = 0, m = list.length; j < m; j += 2) {
          result.push([list[j], list[j + 1]]);
        }
      }
      return result;
    };
    proto.cells = function() {
      var stars = this.stars;
      var result = [];
      for (var i = 0, n = stars.length; i < n; ++i) {
        var list = stars[i];
        for (var j = 0, m = list.length; j < m; j += 2) {
          var s = list[j];
          var t = list[j + 1];
          if (i < Math.min(s, t)) {
            result.push([i, s, t]);
          }
        }
      }
      return result;
    };
    function createTriangulation(numVerts, edges) {
      var stars = new Array(numVerts);
      for (var i = 0; i < numVerts; ++i) {
        stars[i] = [];
      }
      return new Triangulation(stars, edges);
    }
  }
});

// tailor-unify-20261007/toolchain/node_modules/robust-in-sphere/in-sphere.js
var require_in_sphere = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/robust-in-sphere/in-sphere.js"(exports, module2) {
    "use strict";
    var twoProduct = require_two_product();
    var robustSum = require_robust_sum();
    var robustDiff = require_robust_diff();
    var robustScale = require_robust_scale();
    var NUM_EXPAND = 6;
    function orientation(n) {
      var fn = n === 3 ? inSphere3 : n === 4 ? inSphere4 : n === 5 ? inSphere5 : inSphere6;
      return fn(robustSum, robustDiff, twoProduct, robustScale);
    }
    function inSphere0() {
      return 0;
    }
    function inSphere1() {
      return 0;
    }
    function inSphere2() {
      return 0;
    }
    function inSphere3(sum, diff, prod, scale) {
      function exactInSphere3(m0, m1, m2) {
        var w0 = prod(m0[0], m0[0]);
        var w0m1 = scale(w0, m1[0]);
        var w0m2 = scale(w0, m2[0]);
        var w1 = prod(m1[0], m1[0]);
        var w1m0 = scale(w1, m0[0]);
        var w1m2 = scale(w1, m2[0]);
        var w2 = prod(m2[0], m2[0]);
        var w2m0 = scale(w2, m0[0]);
        var w2m1 = scale(w2, m1[0]);
        var p = sum(diff(w2m1, w1m2), diff(w1m0, w0m1));
        var n = diff(w2m0, w0m2);
        var d = diff(p, n);
        return d[d.length - 1];
      }
      return exactInSphere3;
    }
    function inSphere4(sum, diff, prod, scale) {
      function exactInSphere4(m0, m1, m2, m3) {
        var w0 = sum(prod(m0[0], m0[0]), prod(m0[1], m0[1]));
        var w0m1 = scale(w0, m1[0]);
        var w0m2 = scale(w0, m2[0]);
        var w0m3 = scale(w0, m3[0]);
        var w1 = sum(prod(m1[0], m1[0]), prod(m1[1], m1[1]));
        var w1m0 = scale(w1, m0[0]);
        var w1m2 = scale(w1, m2[0]);
        var w1m3 = scale(w1, m3[0]);
        var w2 = sum(prod(m2[0], m2[0]), prod(m2[1], m2[1]));
        var w2m0 = scale(w2, m0[0]);
        var w2m1 = scale(w2, m1[0]);
        var w2m3 = scale(w2, m3[0]);
        var w3 = sum(prod(m3[0], m3[0]), prod(m3[1], m3[1]));
        var w3m0 = scale(w3, m0[0]);
        var w3m1 = scale(w3, m1[0]);
        var w3m2 = scale(w3, m2[0]);
        var p = sum(sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))), sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))));
        var n = sum(sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))), sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))));
        var d = diff(p, n);
        return d[d.length - 1];
      }
      return exactInSphere4;
    }
    function inSphere5(sum, diff, prod, scale) {
      function exactInSphere5(m0, m1, m2, m3, m4) {
        var w0 = sum(prod(m0[0], m0[0]), sum(prod(m0[1], m0[1]), prod(m0[2], m0[2])));
        var w0m1 = scale(w0, m1[0]);
        var w0m2 = scale(w0, m2[0]);
        var w0m3 = scale(w0, m3[0]);
        var w0m4 = scale(w0, m4[0]);
        var w1 = sum(prod(m1[0], m1[0]), sum(prod(m1[1], m1[1]), prod(m1[2], m1[2])));
        var w1m0 = scale(w1, m0[0]);
        var w1m2 = scale(w1, m2[0]);
        var w1m3 = scale(w1, m3[0]);
        var w1m4 = scale(w1, m4[0]);
        var w2 = sum(prod(m2[0], m2[0]), sum(prod(m2[1], m2[1]), prod(m2[2], m2[2])));
        var w2m0 = scale(w2, m0[0]);
        var w2m1 = scale(w2, m1[0]);
        var w2m3 = scale(w2, m3[0]);
        var w2m4 = scale(w2, m4[0]);
        var w3 = sum(prod(m3[0], m3[0]), sum(prod(m3[1], m3[1]), prod(m3[2], m3[2])));
        var w3m0 = scale(w3, m0[0]);
        var w3m1 = scale(w3, m1[0]);
        var w3m2 = scale(w3, m2[0]);
        var w3m4 = scale(w3, m4[0]);
        var w4 = sum(prod(m4[0], m4[0]), sum(prod(m4[1], m4[1]), prod(m4[2], m4[2])));
        var w4m0 = scale(w4, m0[0]);
        var w4m1 = scale(w4, m1[0]);
        var w4m2 = scale(w4, m2[0]);
        var w4m3 = scale(w4, m3[0]);
        var p = sum(sum(sum(scale(sum(scale(diff(w4m3, w3m4), m2[1]), sum(scale(diff(w4m2, w2m4), -m3[1]), scale(diff(w3m2, w2m3), m4[1]))), m1[2]), sum(scale(sum(scale(diff(w4m3, w3m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m3[1]), scale(diff(w3m1, w1m3), m4[1]))), -m2[2]), scale(sum(scale(diff(w4m2, w2m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m2[1]), scale(diff(w2m1, w1m2), m4[1]))), m3[2]))), sum(scale(sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))), -m4[2]), sum(scale(sum(scale(diff(w4m3, w3m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m3[1]), scale(diff(w3m1, w1m3), m4[1]))), m0[2]), scale(sum(scale(diff(w4m3, w3m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m3[1]), scale(diff(w3m0, w0m3), m4[1]))), -m1[2])))), sum(sum(scale(sum(scale(diff(w4m1, w1m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m1[1]), scale(diff(w1m0, w0m1), m4[1]))), m3[2]), sum(scale(sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))), -m4[2]), scale(sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))), m0[2]))), sum(scale(sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))), -m1[2]), sum(scale(sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))), m2[2]), scale(sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))), -m3[2])))));
        var n = sum(sum(sum(scale(sum(scale(diff(w4m3, w3m4), m2[1]), sum(scale(diff(w4m2, w2m4), -m3[1]), scale(diff(w3m2, w2m3), m4[1]))), m0[2]), scale(sum(scale(diff(w4m3, w3m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m3[1]), scale(diff(w3m0, w0m3), m4[1]))), -m2[2])), sum(scale(sum(scale(diff(w4m2, w2m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m2[1]), scale(diff(w2m0, w0m2), m4[1]))), m3[2]), scale(sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))), -m4[2]))), sum(sum(scale(sum(scale(diff(w4m2, w2m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m2[1]), scale(diff(w2m1, w1m2), m4[1]))), m0[2]), scale(sum(scale(diff(w4m2, w2m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m2[1]), scale(diff(w2m0, w0m2), m4[1]))), -m1[2])), sum(scale(sum(scale(diff(w4m1, w1m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m1[1]), scale(diff(w1m0, w0m1), m4[1]))), m2[2]), scale(sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))), -m4[2]))));
        var d = diff(p, n);
        return d[d.length - 1];
      }
      return exactInSphere5;
    }
    function inSphere6(sum, diff, prod, scale) {
      function exactInSphere6(m0, m1, m2, m3, m4, m5) {
        var w0 = sum(sum(prod(m0[0], m0[0]), prod(m0[1], m0[1])), sum(prod(m0[2], m0[2]), prod(m0[3], m0[3])));
        var w0m1 = scale(w0, m1[0]);
        var w0m2 = scale(w0, m2[0]);
        var w0m3 = scale(w0, m3[0]);
        var w0m4 = scale(w0, m4[0]);
        var w0m5 = scale(w0, m5[0]);
        var w1 = sum(sum(prod(m1[0], m1[0]), prod(m1[1], m1[1])), sum(prod(m1[2], m1[2]), prod(m1[3], m1[3])));
        var w1m0 = scale(w1, m0[0]);
        var w1m2 = scale(w1, m2[0]);
        var w1m3 = scale(w1, m3[0]);
        var w1m4 = scale(w1, m4[0]);
        var w1m5 = scale(w1, m5[0]);
        var w2 = sum(sum(prod(m2[0], m2[0]), prod(m2[1], m2[1])), sum(prod(m2[2], m2[2]), prod(m2[3], m2[3])));
        var w2m0 = scale(w2, m0[0]);
        var w2m1 = scale(w2, m1[0]);
        var w2m3 = scale(w2, m3[0]);
        var w2m4 = scale(w2, m4[0]);
        var w2m5 = scale(w2, m5[0]);
        var w3 = sum(sum(prod(m3[0], m3[0]), prod(m3[1], m3[1])), sum(prod(m3[2], m3[2]), prod(m3[3], m3[3])));
        var w3m0 = scale(w3, m0[0]);
        var w3m1 = scale(w3, m1[0]);
        var w3m2 = scale(w3, m2[0]);
        var w3m4 = scale(w3, m4[0]);
        var w3m5 = scale(w3, m5[0]);
        var w4 = sum(sum(prod(m4[0], m4[0]), prod(m4[1], m4[1])), sum(prod(m4[2], m4[2]), prod(m4[3], m4[3])));
        var w4m0 = scale(w4, m0[0]);
        var w4m1 = scale(w4, m1[0]);
        var w4m2 = scale(w4, m2[0]);
        var w4m3 = scale(w4, m3[0]);
        var w4m5 = scale(w4, m5[0]);
        var w5 = sum(sum(prod(m5[0], m5[0]), prod(m5[1], m5[1])), sum(prod(m5[2], m5[2]), prod(m5[3], m5[3])));
        var w5m0 = scale(w5, m0[0]);
        var w5m1 = scale(w5, m1[0]);
        var w5m2 = scale(w5, m2[0]);
        var w5m3 = scale(w5, m3[0]);
        var w5m4 = scale(w5, m4[0]);
        var p = sum(sum(sum(scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m3[1]), sum(scale(diff(w5m3, w3m5), -m4[1]), scale(diff(w4m3, w3m4), m5[1]))), m2[2]), scale(sum(scale(diff(w5m4, w4m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m4[1]), scale(diff(w4m2, w2m4), m5[1]))), -m3[2])), sum(scale(sum(scale(diff(w5m3, w3m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m3[1]), scale(diff(w3m2, w2m3), m5[1]))), m4[2]), scale(sum(scale(diff(w4m3, w3m4), m2[1]), sum(scale(diff(w4m2, w2m4), -m3[1]), scale(diff(w3m2, w2m3), m4[1]))), -m5[2]))), m1[3]), sum(scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m3[1]), sum(scale(diff(w5m3, w3m5), -m4[1]), scale(diff(w4m3, w3m4), m5[1]))), m1[2]), scale(sum(scale(diff(w5m4, w4m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m4[1]), scale(diff(w4m1, w1m4), m5[1]))), -m3[2])), sum(scale(sum(scale(diff(w5m3, w3m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m3[1]), scale(diff(w3m1, w1m3), m5[1]))), m4[2]), scale(sum(scale(diff(w4m3, w3m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m3[1]), scale(diff(w3m1, w1m3), m4[1]))), -m5[2]))), -m2[3]), scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m4[1]), scale(diff(w4m2, w2m4), m5[1]))), m1[2]), scale(sum(scale(diff(w5m4, w4m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m4[1]), scale(diff(w4m1, w1m4), m5[1]))), -m2[2])), sum(scale(sum(scale(diff(w5m2, w2m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m2[1]), scale(diff(w2m1, w1m2), m5[1]))), m4[2]), scale(sum(scale(diff(w4m2, w2m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m2[1]), scale(diff(w2m1, w1m2), m4[1]))), -m5[2]))), m3[3]))), sum(sum(scale(sum(sum(scale(sum(scale(diff(w5m3, w3m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m3[1]), scale(diff(w3m2, w2m3), m5[1]))), m1[2]), scale(sum(scale(diff(w5m3, w3m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m3[1]), scale(diff(w3m1, w1m3), m5[1]))), -m2[2])), sum(scale(sum(scale(diff(w5m2, w2m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m2[1]), scale(diff(w2m1, w1m2), m5[1]))), m3[2]), scale(sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))), -m5[2]))), -m4[3]), scale(sum(sum(scale(sum(scale(diff(w4m3, w3m4), m2[1]), sum(scale(diff(w4m2, w2m4), -m3[1]), scale(diff(w3m2, w2m3), m4[1]))), m1[2]), scale(sum(scale(diff(w4m3, w3m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m3[1]), scale(diff(w3m1, w1m3), m4[1]))), -m2[2])), sum(scale(sum(scale(diff(w4m2, w2m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m2[1]), scale(diff(w2m1, w1m2), m4[1]))), m3[2]), scale(sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))), -m4[2]))), m5[3])), sum(scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m3[1]), sum(scale(diff(w5m3, w3m5), -m4[1]), scale(diff(w4m3, w3m4), m5[1]))), m1[2]), scale(sum(scale(diff(w5m4, w4m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m4[1]), scale(diff(w4m1, w1m4), m5[1]))), -m3[2])), sum(scale(sum(scale(diff(w5m3, w3m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m3[1]), scale(diff(w3m1, w1m3), m5[1]))), m4[2]), scale(sum(scale(diff(w4m3, w3m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m3[1]), scale(diff(w3m1, w1m3), m4[1]))), -m5[2]))), m0[3]), scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m3[1]), sum(scale(diff(w5m3, w3m5), -m4[1]), scale(diff(w4m3, w3m4), m5[1]))), m0[2]), scale(sum(scale(diff(w5m4, w4m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m4[1]), scale(diff(w4m0, w0m4), m5[1]))), -m3[2])), sum(scale(sum(scale(diff(w5m3, w3m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m3[1]), scale(diff(w3m0, w0m3), m5[1]))), m4[2]), scale(sum(scale(diff(w4m3, w3m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m3[1]), scale(diff(w3m0, w0m3), m4[1]))), -m5[2]))), -m1[3])))), sum(sum(sum(scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m4[1]), scale(diff(w4m1, w1m4), m5[1]))), m0[2]), scale(sum(scale(diff(w5m4, w4m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m4[1]), scale(diff(w4m0, w0m4), m5[1]))), -m1[2])), sum(scale(sum(scale(diff(w5m1, w1m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m1[1]), scale(diff(w1m0, w0m1), m5[1]))), m4[2]), scale(sum(scale(diff(w4m1, w1m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m1[1]), scale(diff(w1m0, w0m1), m4[1]))), -m5[2]))), m3[3]), scale(sum(sum(scale(sum(scale(diff(w5m3, w3m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m3[1]), scale(diff(w3m1, w1m3), m5[1]))), m0[2]), scale(sum(scale(diff(w5m3, w3m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m3[1]), scale(diff(w3m0, w0m3), m5[1]))), -m1[2])), sum(scale(sum(scale(diff(w5m1, w1m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m1[1]), scale(diff(w1m0, w0m1), m5[1]))), m3[2]), scale(sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))), -m5[2]))), -m4[3])), sum(scale(sum(sum(scale(sum(scale(diff(w4m3, w3m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m3[1]), scale(diff(w3m1, w1m3), m4[1]))), m0[2]), scale(sum(scale(diff(w4m3, w3m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m3[1]), scale(diff(w3m0, w0m3), m4[1]))), -m1[2])), sum(scale(sum(scale(diff(w4m1, w1m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m1[1]), scale(diff(w1m0, w0m1), m4[1]))), m3[2]), scale(sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))), -m4[2]))), m5[3]), scale(sum(sum(scale(sum(scale(diff(w5m3, w3m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m3[1]), scale(diff(w3m2, w2m3), m5[1]))), m1[2]), scale(sum(scale(diff(w5m3, w3m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m3[1]), scale(diff(w3m1, w1m3), m5[1]))), -m2[2])), sum(scale(sum(scale(diff(w5m2, w2m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m2[1]), scale(diff(w2m1, w1m2), m5[1]))), m3[2]), scale(sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))), -m5[2]))), m0[3]))), sum(sum(scale(sum(sum(scale(sum(scale(diff(w5m3, w3m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m3[1]), scale(diff(w3m2, w2m3), m5[1]))), m0[2]), scale(sum(scale(diff(w5m3, w3m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m3[1]), scale(diff(w3m0, w0m3), m5[1]))), -m2[2])), sum(scale(sum(scale(diff(w5m2, w2m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m2[1]), scale(diff(w2m0, w0m2), m5[1]))), m3[2]), scale(sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))), -m5[2]))), -m1[3]), scale(sum(sum(scale(sum(scale(diff(w5m3, w3m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m3[1]), scale(diff(w3m1, w1m3), m5[1]))), m0[2]), scale(sum(scale(diff(w5m3, w3m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m3[1]), scale(diff(w3m0, w0m3), m5[1]))), -m1[2])), sum(scale(sum(scale(diff(w5m1, w1m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m1[1]), scale(diff(w1m0, w0m1), m5[1]))), m3[2]), scale(sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))), -m5[2]))), m2[3])), sum(scale(sum(sum(scale(sum(scale(diff(w5m2, w2m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m2[1]), scale(diff(w2m1, w1m2), m5[1]))), m0[2]), scale(sum(scale(diff(w5m2, w2m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m2[1]), scale(diff(w2m0, w0m2), m5[1]))), -m1[2])), sum(scale(sum(scale(diff(w5m1, w1m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m1[1]), scale(diff(w1m0, w0m1), m5[1]))), m2[2]), scale(sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))), -m5[2]))), -m3[3]), scale(sum(sum(scale(sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))), m0[2]), scale(sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))), -m1[2])), sum(scale(sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))), m2[2]), scale(sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))), -m3[2]))), m5[3])))));
        var n = sum(sum(sum(scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m3[1]), sum(scale(diff(w5m3, w3m5), -m4[1]), scale(diff(w4m3, w3m4), m5[1]))), m2[2]), scale(sum(scale(diff(w5m4, w4m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m4[1]), scale(diff(w4m2, w2m4), m5[1]))), -m3[2])), sum(scale(sum(scale(diff(w5m3, w3m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m3[1]), scale(diff(w3m2, w2m3), m5[1]))), m4[2]), scale(sum(scale(diff(w4m3, w3m4), m2[1]), sum(scale(diff(w4m2, w2m4), -m3[1]), scale(diff(w3m2, w2m3), m4[1]))), -m5[2]))), m0[3]), sum(scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m3[1]), sum(scale(diff(w5m3, w3m5), -m4[1]), scale(diff(w4m3, w3m4), m5[1]))), m0[2]), scale(sum(scale(diff(w5m4, w4m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m4[1]), scale(diff(w4m0, w0m4), m5[1]))), -m3[2])), sum(scale(sum(scale(diff(w5m3, w3m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m3[1]), scale(diff(w3m0, w0m3), m5[1]))), m4[2]), scale(sum(scale(diff(w4m3, w3m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m3[1]), scale(diff(w3m0, w0m3), m4[1]))), -m5[2]))), -m2[3]), scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m4[1]), scale(diff(w4m2, w2m4), m5[1]))), m0[2]), scale(sum(scale(diff(w5m4, w4m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m4[1]), scale(diff(w4m0, w0m4), m5[1]))), -m2[2])), sum(scale(sum(scale(diff(w5m2, w2m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m2[1]), scale(diff(w2m0, w0m2), m5[1]))), m4[2]), scale(sum(scale(diff(w4m2, w2m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m2[1]), scale(diff(w2m0, w0m2), m4[1]))), -m5[2]))), m3[3]))), sum(sum(scale(sum(sum(scale(sum(scale(diff(w5m3, w3m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m3[1]), scale(diff(w3m2, w2m3), m5[1]))), m0[2]), scale(sum(scale(diff(w5m3, w3m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m3[1]), scale(diff(w3m0, w0m3), m5[1]))), -m2[2])), sum(scale(sum(scale(diff(w5m2, w2m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m2[1]), scale(diff(w2m0, w0m2), m5[1]))), m3[2]), scale(sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))), -m5[2]))), -m4[3]), scale(sum(sum(scale(sum(scale(diff(w4m3, w3m4), m2[1]), sum(scale(diff(w4m2, w2m4), -m3[1]), scale(diff(w3m2, w2m3), m4[1]))), m0[2]), scale(sum(scale(diff(w4m3, w3m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m3[1]), scale(diff(w3m0, w0m3), m4[1]))), -m2[2])), sum(scale(sum(scale(diff(w4m2, w2m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m2[1]), scale(diff(w2m0, w0m2), m4[1]))), m3[2]), scale(sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))), -m4[2]))), m5[3])), sum(scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m4[1]), scale(diff(w4m2, w2m4), m5[1]))), m1[2]), scale(sum(scale(diff(w5m4, w4m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m4[1]), scale(diff(w4m1, w1m4), m5[1]))), -m2[2])), sum(scale(sum(scale(diff(w5m2, w2m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m2[1]), scale(diff(w2m1, w1m2), m5[1]))), m4[2]), scale(sum(scale(diff(w4m2, w2m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m2[1]), scale(diff(w2m1, w1m2), m4[1]))), -m5[2]))), m0[3]), scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m4[1]), scale(diff(w4m2, w2m4), m5[1]))), m0[2]), scale(sum(scale(diff(w5m4, w4m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m4[1]), scale(diff(w4m0, w0m4), m5[1]))), -m2[2])), sum(scale(sum(scale(diff(w5m2, w2m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m2[1]), scale(diff(w2m0, w0m2), m5[1]))), m4[2]), scale(sum(scale(diff(w4m2, w2m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m2[1]), scale(diff(w2m0, w0m2), m4[1]))), -m5[2]))), -m1[3])))), sum(sum(sum(scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m4[1]), scale(diff(w4m1, w1m4), m5[1]))), m0[2]), scale(sum(scale(diff(w5m4, w4m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m4[1]), scale(diff(w4m0, w0m4), m5[1]))), -m1[2])), sum(scale(sum(scale(diff(w5m1, w1m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m1[1]), scale(diff(w1m0, w0m1), m5[1]))), m4[2]), scale(sum(scale(diff(w4m1, w1m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m1[1]), scale(diff(w1m0, w0m1), m4[1]))), -m5[2]))), m2[3]), scale(sum(sum(scale(sum(scale(diff(w5m2, w2m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m2[1]), scale(diff(w2m1, w1m2), m5[1]))), m0[2]), scale(sum(scale(diff(w5m2, w2m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m2[1]), scale(diff(w2m0, w0m2), m5[1]))), -m1[2])), sum(scale(sum(scale(diff(w5m1, w1m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m1[1]), scale(diff(w1m0, w0m1), m5[1]))), m2[2]), scale(sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))), -m5[2]))), -m4[3])), sum(scale(sum(sum(scale(sum(scale(diff(w4m2, w2m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m2[1]), scale(diff(w2m1, w1m2), m4[1]))), m0[2]), scale(sum(scale(diff(w4m2, w2m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m2[1]), scale(diff(w2m0, w0m2), m4[1]))), -m1[2])), sum(scale(sum(scale(diff(w4m1, w1m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m1[1]), scale(diff(w1m0, w0m1), m4[1]))), m2[2]), scale(sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))), -m4[2]))), m5[3]), scale(sum(sum(scale(sum(scale(diff(w4m3, w3m4), m2[1]), sum(scale(diff(w4m2, w2m4), -m3[1]), scale(diff(w3m2, w2m3), m4[1]))), m1[2]), scale(sum(scale(diff(w4m3, w3m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m3[1]), scale(diff(w3m1, w1m3), m4[1]))), -m2[2])), sum(scale(sum(scale(diff(w4m2, w2m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m2[1]), scale(diff(w2m1, w1m2), m4[1]))), m3[2]), scale(sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))), -m4[2]))), m0[3]))), sum(sum(scale(sum(sum(scale(sum(scale(diff(w4m3, w3m4), m2[1]), sum(scale(diff(w4m2, w2m4), -m3[1]), scale(diff(w3m2, w2m3), m4[1]))), m0[2]), scale(sum(scale(diff(w4m3, w3m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m3[1]), scale(diff(w3m0, w0m3), m4[1]))), -m2[2])), sum(scale(sum(scale(diff(w4m2, w2m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m2[1]), scale(diff(w2m0, w0m2), m4[1]))), m3[2]), scale(sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))), -m4[2]))), -m1[3]), scale(sum(sum(scale(sum(scale(diff(w4m3, w3m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m3[1]), scale(diff(w3m1, w1m3), m4[1]))), m0[2]), scale(sum(scale(diff(w4m3, w3m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m3[1]), scale(diff(w3m0, w0m3), m4[1]))), -m1[2])), sum(scale(sum(scale(diff(w4m1, w1m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m1[1]), scale(diff(w1m0, w0m1), m4[1]))), m3[2]), scale(sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))), -m4[2]))), m2[3])), sum(scale(sum(sum(scale(sum(scale(diff(w4m2, w2m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m2[1]), scale(diff(w2m1, w1m2), m4[1]))), m0[2]), scale(sum(scale(diff(w4m2, w2m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m2[1]), scale(diff(w2m0, w0m2), m4[1]))), -m1[2])), sum(scale(sum(scale(diff(w4m1, w1m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m1[1]), scale(diff(w1m0, w0m1), m4[1]))), m2[2]), scale(sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))), -m4[2]))), -m3[3]), scale(sum(sum(scale(sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))), m0[2]), scale(sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))), -m1[2])), sum(scale(sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))), m2[2]), scale(sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))), -m3[2]))), m4[3])))));
        var d = diff(p, n);
        return d[d.length - 1];
      }
      return exactInSphere6;
    }
    var CACHED = [
      inSphere0,
      inSphere1,
      inSphere2
    ];
    function slowInSphere(args) {
      var proc2 = CACHED[args.length];
      if (!proc2) {
        proc2 = CACHED[args.length] = orientation(args.length);
      }
      return proc2.apply(void 0, args);
    }
    function proc(slow, o0, o1, o2, o3, o4, o5, o6) {
      function testInSphere(a0, a1, a2, a3, a4, a5) {
        switch (arguments.length) {
          case 0:
          case 1:
            return 0;
          case 2:
            return o2(a0, a1);
          case 3:
            return o3(a0, a1, a2);
          case 4:
            return o4(a0, a1, a2, a3);
          case 5:
            return o5(a0, a1, a2, a3, a4);
          case 6:
            return o6(a0, a1, a2, a3, a4, a5);
        }
        var s = new Array(arguments.length);
        for (var i = 0; i < arguments.length; ++i) {
          s[i] = arguments[i];
        }
        return slow(s);
      }
      return testInSphere;
    }
    function generateInSphereTest() {
      while (CACHED.length <= NUM_EXPAND) {
        CACHED.push(orientation(CACHED.length));
      }
      module2.exports = proc.apply(void 0, [slowInSphere].concat(CACHED));
      for (var i = 0; i <= NUM_EXPAND; ++i) {
        module2.exports[i] = CACHED[i];
      }
    }
    generateInSphereTest();
  }
});

// tailor-unify-20261007/toolchain/node_modules/cdt2d/lib/delaunay.js
var require_delaunay = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/cdt2d/lib/delaunay.js"(exports, module2) {
    "use strict";
    var inCircle = require_in_sphere()[4];
    var bsearch = require_search_bounds();
    module2.exports = delaunayRefine;
    function testFlip(points, triangulation, stack, a, b, x) {
      var y = triangulation.opposite(a, b);
      if (y < 0) {
        return;
      }
      if (b < a) {
        var tmp = a;
        a = b;
        b = tmp;
        tmp = x;
        x = y;
        y = tmp;
      }
      if (triangulation.isConstraint(a, b)) {
        return;
      }
      if (inCircle(points[a], points[b], points[x], points[y]) < 0) {
        stack.push(a, b);
      }
    }
    function delaunayRefine(points, triangulation) {
      var stack = [];
      var numPoints = points.length;
      var stars = triangulation.stars;
      for (var a = 0; a < numPoints; ++a) {
        var star = stars[a];
        for (var j = 1; j < star.length; j += 2) {
          var b = star[j];
          if (b < a) {
            continue;
          }
          if (triangulation.isConstraint(a, b)) {
            continue;
          }
          var x = star[j - 1], y = -1;
          for (var k = 1; k < star.length; k += 2) {
            if (star[k - 1] === b) {
              y = star[k];
              break;
            }
          }
          if (y < 0) {
            continue;
          }
          if (inCircle(points[a], points[b], points[x], points[y]) < 0) {
            stack.push(a, b);
          }
        }
      }
      while (stack.length > 0) {
        var b = stack.pop();
        var a = stack.pop();
        var x = -1, y = -1;
        var star = stars[a];
        for (var i = 1; i < star.length; i += 2) {
          var s = star[i - 1];
          var t = star[i];
          if (s === b) {
            y = t;
          } else if (t === b) {
            x = s;
          }
        }
        if (x < 0 || y < 0) {
          continue;
        }
        if (inCircle(points[a], points[b], points[x], points[y]) >= 0) {
          continue;
        }
        triangulation.flip(a, b);
        testFlip(points, triangulation, stack, x, a, y);
        testFlip(points, triangulation, stack, a, y, x);
        testFlip(points, triangulation, stack, y, b, x);
        testFlip(points, triangulation, stack, b, x, y);
      }
    }
  }
});

// tailor-unify-20261007/toolchain/node_modules/cdt2d/lib/filter.js
var require_filter = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/cdt2d/lib/filter.js"(exports, module2) {
    "use strict";
    var bsearch = require_search_bounds();
    module2.exports = classifyFaces;
    function FaceIndex(cells, neighbor, constraint, flags, active, next, boundary) {
      this.cells = cells;
      this.neighbor = neighbor;
      this.flags = flags;
      this.constraint = constraint;
      this.active = active;
      this.next = next;
      this.boundary = boundary;
    }
    var proto = FaceIndex.prototype;
    function compareCell(a, b) {
      return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    }
    proto.locate = /* @__PURE__ */ (function() {
      var key = [0, 0, 0];
      return function(a, b, c) {
        var x = a, y = b, z = c;
        if (b < c) {
          if (b < a) {
            x = b;
            y = c;
            z = a;
          }
        } else if (c < a) {
          x = c;
          y = a;
          z = b;
        }
        if (x < 0) {
          return -1;
        }
        key[0] = x;
        key[1] = y;
        key[2] = z;
        return bsearch.eq(this.cells, key, compareCell);
      };
    })();
    function indexCells(triangulation, infinity) {
      var cells = triangulation.cells();
      var nc = cells.length;
      for (var i = 0; i < nc; ++i) {
        var c = cells[i];
        var x = c[0], y = c[1], z = c[2];
        if (y < z) {
          if (y < x) {
            c[0] = y;
            c[1] = z;
            c[2] = x;
          }
        } else if (z < x) {
          c[0] = z;
          c[1] = x;
          c[2] = y;
        }
      }
      cells.sort(compareCell);
      var flags = new Array(nc);
      for (var i = 0; i < flags.length; ++i) {
        flags[i] = 0;
      }
      var active = [];
      var next = [];
      var neighbor = new Array(3 * nc);
      var constraint = new Array(3 * nc);
      var boundary = null;
      if (infinity) {
        boundary = [];
      }
      var index = new FaceIndex(
        cells,
        neighbor,
        constraint,
        flags,
        active,
        next,
        boundary
      );
      for (var i = 0; i < nc; ++i) {
        var c = cells[i];
        for (var j = 0; j < 3; ++j) {
          var x = c[j], y = c[(j + 1) % 3];
          var a = neighbor[3 * i + j] = index.locate(y, x, triangulation.opposite(y, x));
          var b = constraint[3 * i + j] = triangulation.isConstraint(x, y);
          if (a < 0) {
            if (b) {
              next.push(i);
            } else {
              active.push(i);
              flags[i] = 1;
            }
            if (infinity) {
              boundary.push([y, x, -1]);
            }
          }
        }
      }
      return index;
    }
    function filterCells(cells, flags, target) {
      var ptr = 0;
      for (var i = 0; i < cells.length; ++i) {
        if (flags[i] === target) {
          cells[ptr++] = cells[i];
        }
      }
      cells.length = ptr;
      return cells;
    }
    function classifyFaces(triangulation, target, infinity) {
      var index = indexCells(triangulation, infinity);
      if (target === 0) {
        if (infinity) {
          return index.cells.concat(index.boundary);
        } else {
          return index.cells;
        }
      }
      var side = 1;
      var active = index.active;
      var next = index.next;
      var flags = index.flags;
      var cells = index.cells;
      var constraint = index.constraint;
      var neighbor = index.neighbor;
      while (active.length > 0 || next.length > 0) {
        while (active.length > 0) {
          var t = active.pop();
          if (flags[t] === -side) {
            continue;
          }
          flags[t] = side;
          var c = cells[t];
          for (var j = 0; j < 3; ++j) {
            var f = neighbor[3 * t + j];
            if (f >= 0 && flags[f] === 0) {
              if (constraint[3 * t + j]) {
                next.push(f);
              } else {
                active.push(f);
                flags[f] = side;
              }
            }
          }
        }
        var tmp = next;
        next = active;
        active = tmp;
        next.length = 0;
        side = -side;
      }
      var result = filterCells(cells, flags, target);
      if (infinity) {
        return result.concat(index.boundary);
      }
      return result;
    }
  }
});

// tailor-unify-20261007/toolchain/node_modules/cdt2d/cdt2d.js
var require_cdt2d = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/cdt2d/cdt2d.js"(exports, module2) {
    "use strict";
    var monotoneTriangulate = require_monotone();
    var makeIndex = require_triangulation();
    var delaunayFlip = require_delaunay();
    var filterTriangulation = require_filter();
    module2.exports = cdt2d4;
    function canonicalizeEdge(e) {
      return [Math.min(e[0], e[1]), Math.max(e[0], e[1])];
    }
    function compareEdge(a, b) {
      return a[0] - b[0] || a[1] - b[1];
    }
    function canonicalizeEdges(edges) {
      return edges.map(canonicalizeEdge).sort(compareEdge);
    }
    function getDefault(options, property, dflt) {
      if (property in options) {
        return options[property];
      }
      return dflt;
    }
    function cdt2d4(points, edges, options) {
      if (!Array.isArray(edges)) {
        options = edges || {};
        edges = [];
      } else {
        options = options || {};
        edges = edges || [];
      }
      var delaunay = !!getDefault(options, "delaunay", true);
      var interior = !!getDefault(options, "interior", true);
      var exterior = !!getDefault(options, "exterior", true);
      var infinity = !!getDefault(options, "infinity", false);
      if (!interior && !exterior || points.length === 0) {
        return [];
      }
      var cells = monotoneTriangulate(points, edges);
      if (delaunay || interior !== exterior || infinity) {
        var triangulation = makeIndex(points.length, canonicalizeEdges(edges));
        for (var i = 0; i < cells.length; ++i) {
          var f = cells[i];
          triangulation.addTriangle(f[0], f[1], f[2]);
        }
        if (delaunay) {
          delaunayFlip(points, triangulation);
        }
        if (!exterior) {
          return filterTriangulation(triangulation, -1);
        } else if (!interior) {
          return filterTriangulation(triangulation, 1, infinity);
        } else if (infinity) {
          return filterTriangulation(triangulation, 0, infinity);
        } else {
          return triangulation.cells();
        }
      } else {
        return cells;
      }
    }
  }
});

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r03/src/paper-program.mjs
var paper_program_exports = {};
__export(paper_program_exports, {
  PROGRAM: () => PROGRAM,
  edgeLength: () => edgeLength,
  gradePaper: () => gradePaper,
  meshPaper: () => meshPaper,
  paperSummary: () => paperSummary
});
var import_cdt2d = __toESM(require_cdt2d(), 1);

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r03/src/core.mjs
var SCHEMA = "kaopu-sewing-graph@1";
var clone = (x) => JSON.parse(JSON.stringify(x));
var distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
var finite = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
var fail = (code, detail) => {
  throw new Error(`${code}: ${detail}`);
};
var len = (p, ids) => ids.slice(1).reduce((s, id, k) => s + distance(p.uvMm[id], p.uvMm[ids[k]]), 0);
var cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
var on = (a, b, p) => Math.abs(cross(a, b, p)) < 1e-7 && p[0] >= Math.min(a[0], b[0]) - 1e-7 && p[0] <= Math.max(a[0], b[0]) + 1e-7 && p[1] >= Math.min(a[1], b[1]) - 1e-7 && p[1] <= Math.max(a[1], b[1]) + 1e-7;
var intersect = (a, b, c, d) => cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0 || on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b);
function directedEdge(spec2, end) {
  const p = spec2.panels.find((p2) => p2.id === end.panelId);
  if (!p) fail("MISSING_PANEL", end.panelId);
  const ids = p.edges[end.edge];
  if (!ids) fail("MISSING_EDGE", `${p.id}.${end.edge}`);
  return { panel: p, ids: end.reverse ? [...ids].reverse() : [...ids] };
}
function validate(spec2) {
  if (!spec2 || spec2.schema !== SCHEMA) fail("SCHEMA", `expected ${SCHEMA}`);
  if (spec2.units !== "mm") fail("UNITS", "explicit millimetres required");
  if (!Number.isInteger(spec2.revision) || spec2.revision < 1) fail("REVISION", "positive integer required");
  if (!Array.isArray(spec2.panels) || !spec2.panels.length || spec2.panels.length > 32) fail("PANELS", "1\u201332 panels required");
  for (const key of ["panels", "materials", "seams", "stages"]) {
    if (!Array.isArray(spec2[key])) fail("SCHEMA", `${key} array required`);
    const ids = spec2[key].map((p) => p.id);
    if (ids.some((x) => typeof x !== "string" || !x) || new Set(ids).size !== ids.length) fail("DUPLICATE_ID", key);
  }
  if (spec2.acceptance?.productionReady !== false || spec2.acceptance?.fitValidated !== false) fail("ACCEPTANCE", "learning input cannot pre-accept garment");
  let vertexCount = 0, triangleCount = 0;
  for (const m of spec2.materials) if (![m.densityKgM2, m.stretchCompliance, m.bendCompliance].every(Number.isFinite) || !(m.densityKgM2 > 0 && m.densityKgM2 < 10 && m.stretchCompliance >= 0 && m.bendCompliance >= 0) || m.calibrated !== false) fail("MATERIAL", "uncalibrated finite positive demo material required");
  for (const p of spec2.panels) {
    if (!p.source?.version || !p.source?.kind) fail("SOURCE", p.id);
    if (!spec2.materials.some((m) => m.id === p.materialId)) fail("MATERIAL_REFERENCE", p.id);
    if (!Array.isArray(p.uvMm) || p.uvMm.length < 3 || p.uvMm.length > 3e3 || p.uvMm.some((x) => !finite(x) || x.some((v) => Math.abs(v) > 2e3))) fail("MATERIAL_COORDINATES", p.id);
    const indices = (ids) => Array.isArray(ids) && ids.length >= 2 && ids.every((i) => Number.isInteger(i) && i >= 0 && i < p.uvMm.length);
    if (!Array.isArray(p.triangles) || !p.triangles.length || p.triangles.length > 6e3) fail("TRIANGLES", p.id);
    for (const tri of p.triangles) if (!indices(tri) || tri.length !== 3 || new Set(tri).size !== 3 || cross(...tri.map((i) => p.uvMm[i])) <= 1e-7) fail("TRIANGLE_AREA", p.id);
    const usedVertices = new Set(p.triangles.flat()), meshEdges = /* @__PURE__ */ new Map(), triIds = /* @__PURE__ */ new Set();
    for (const tri of p.triangles) {
      const key = [...tri].sort((a, b2) => a - b2).join(":");
      if (triIds.has(key)) fail("DUPLICATE_TRIANGLE", p.id);
      triIds.add(key);
      for (let i = 0; i < 3; i++) {
        const key2 = [tri[i], tri[(i + 1) % 3]].sort((a, b2) => a - b2).join(":");
        meshEdges.set(key2, (meshEdges.get(key2) || 0) + 1);
      }
    }
    if (usedVertices.size !== p.uvMm.length) fail("UNUSED_MATERIAL_POINT", p.id);
    if ([...meshEdges.values()].some((n) => n > 2)) fail("NONMANIFOLD_MATERIAL", p.id);
    if (!indices(p.boundary) || new Set(p.boundary).size !== p.boundary.length) fail("BOUNDARY", p.id);
    const b = p.boundary.map((i) => p.uvMm[i]);
    for (let i = 0; i < b.length; i++) for (let j = i + 2; j < b.length; j++) {
      if (i === 0 && j === b.length - 1) continue;
      if (intersect(b[i], b[(i + 1) % b.length], b[j], b[(j + 1) % b.length])) fail("BOUNDARY_INTERSECTION", p.id);
    }
    const cutEdges = new Set(p.boundary.map((a, i) => [a, p.boundary[(i + 1) % p.boundary.length]].sort((a2, b2) => a2 - b2).join(":")));
    for (const [key, count] of meshEdges) if (count === 1 !== cutEdges.has(key)) fail("CUT_MESH_BOUNDARY", p.id);
    for (const key of cutEdges) if (meshEdges.get(key) !== 1) fail("CUT_MESH_BOUNDARY", p.id);
    if (!p.edges || Object.values(p.edges).some((ids) => !indices(ids))) fail("EDGES", p.id);
    for (const ids of Object.values(p.edges)) for (let i = 1; i < ids.length; i++) if (!meshEdges.has([ids[i - 1], ids[i]].sort((a, b2) => a - b2).join(":"))) fail("SEAM_NOT_ON_MATERIAL", p.id);
    if (!p.placement || !Array.isArray(p.placement.translationMm) || p.placement.translationMm.length !== 3 || !p.placement.translationMm.every(Number.isFinite) || !Number.isFinite(p.placement.rotationYDeg)) fail("PLACEMENT", p.id);
    if (!Array.isArray(p.temporaryPins) || p.temporaryPins.some((i) => !Number.isInteger(i) || i < 0 || i >= p.uvMm.length)) fail("PINS", p.id);
    if (p.allowanceState !== "meshed_flat_unfolded" || !Number.isFinite(p.seamAllowanceMm) || p.seamAllowanceMm < 0) fail("ALLOWANCE", p.id);
    vertexCount += p.uvMm.length;
    triangleCount += p.triangles.length;
  }
  const stages2 = new Map(spec2.stages.map((s) => [s.id, s])), visited = /* @__PURE__ */ new Set(), visiting = /* @__PURE__ */ new Set(), owners = [];
  function visit(id) {
    if (!stages2.has(id)) fail("STAGE_REFERENCE", id);
    if (visiting.has(id)) fail("STAGE_CYCLE", id);
    if (visited.has(id)) return;
    visiting.add(id);
    const s = stages2.get(id);
    if (!Array.isArray(s.requires) || !Array.isArray(s.seams)) fail("STAGE_SCHEMA", id);
    s.requires.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  }
  for (const s of spec2.stages) {
    visit(s.id);
    for (const id of s.seams) {
      const seam = spec2.seams.find((x) => x.id === id);
      if (!seam || seam.stageId !== s.id) fail("SEAM_STAGE", id);
      owners.push(id);
    }
  }
  if (owners.length !== spec2.seams.length || new Set(owners).size !== owners.length) fail("SEAM_OWNERSHIP", "each seam belongs to one stage");
  const used = /* @__PURE__ */ new Set(), seamReports = [];
  for (const s of spec2.seams) {
    for (const endpoint of [s.a, s.b]) {
      if (typeof endpoint?.reverse !== "boolean") fail("DIRECTION", "explicit edge direction required");
      const k = `${endpoint.panelId}:${endpoint.edge}`;
      if (used.has(k)) fail("EDGE_REUSE", k);
      used.add(k);
    }
    const a = directedEdge(spec2, s.a), b = directedEdge(spec2, s.b), la = len(a.panel, a.ids), lb = len(b.panel, b.ids);
    if (la <= 0 || lb <= 0 || !Number.isFinite(s.easeMm) || Math.abs(lb - la - s.easeMm) > 0.1) fail("EASE_LENGTH", `${s.id}: B\u2212A must match declared ease, not rescale rest geometry`);
    if (Math.abs(s.easeMm) / la > 0.15) fail("EASE_LIMIT", "demo supports up to 15% declared ease");
    if (!Array.isArray(s.notches) || s.notches.length < 2) fail("NOTCHES", "two or more anchors required");
    if (a.ids.length !== b.ids.length) fail("SAMPLING", "R1 solver requires equal seam sample count; resampling is not implemented");
    for (const id of s.notches) {
      const na = a.panel.edgeNotches?.[s.a.edge]?.find((n) => n.id === id), nb = b.panel.edgeNotches?.[s.b.edge]?.find((n) => n.id === id);
      if (!na || !nb) fail("NOTCH_REFERENCE", `${s.id}.${id}`);
      if (![na.t, nb.t].every((t) => Number.isFinite(t) && t >= 0 && t <= 1)) fail("NOTCH_RANGE", s.id);
      const ta = s.a.reverse ? 1 - na.t : na.t, tb = s.b.reverse ? 1 - nb.t : nb.t;
      if (Math.abs(ta - tb) > 1e-6) fail("NOTCH_DIRECTION", `${s.id}.${id}: oriented notches mismatch`);
    }
    seamReports.push({ id: s.id, lengthAMm: la, lengthBMm: lb, easeMm: lb - la, pairCount: a.ids.length });
  }
  return { valid: true, vertexCount, triangleCount, panelCount: spec2.panels.length, seams: seamReports, productionReady: false };
}
function fingerprint(spec2) {
  let hash = 2166136261;
  for (const ch of JSON.stringify(spec2)) {
    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r03/src/paper-program.mjs
var PROGRAM = "kaopu-teacher-shorts-grading@1";
var edgeLength = (p, key) => {
  const e = p.edges[key];
  return e.slice(1).reduce((n, id, j) => n + Math.hypot(...p.uvMm[id].map((x, k) => x - p.uvMm[e[j]][k])), 0);
};
var inside = (q, p) => {
  let yes = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if (a[1] > q[1] !== b[1] > q[1] && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
};
var segDist = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
function gradePaper(base, { legDeltaMm = 0, waistEaseMm = 0 } = {}) {
  if (!Number.isFinite(legDeltaMm) || legDeltaMm < -60 || legDeltaMm > 60 || !Number.isFinite(waistEaseMm) || waistEaseMm < 0 || waistEaseMm > 40) throw Error("\u4EC5\u652F\u6301\u88E4\u957F \u221260\u2026+60 mm\u3001\u8170\u53E3\u677E\u91CF 0\u202640 mm");
  const spec2 = clone(base), original = Object.fromEntries(base.panels.map((p) => [p.id, p])), panels = Object.fromEntries(spec2.panels.map((p) => [p.id, p]));
  const waistSeams = spec2.seams.filter((s) => s.a.panelId.startsWith("wb_") && s.b.panelId.startsWith("pant_"));
  const waistKeys = (p) => waistSeams.filter((s) => s.b.panelId === p.id).map((s) => s.b.edge);
  const fractions = { front: base.source.measurementSnapshot.waist.frontArcMm / base.source.measurementSnapshot.waist.circumferenceMm, back: base.source.measurementSnapshot.waist.backArcMm / base.source.measurementSnapshot.waist.circumferenceMm };
  const totalTop = edgeLength(original.wb_front, "e6") + edgeLength(original.wb_back, "e0");
  if (!Number.isFinite(fractions.front) || !Number.isFinite(fractions.back)) {
    fractions.front = edgeLength(original.wb_front, "e6") / totalTop;
    fractions.back = 1 - fractions.front;
  }
  const operationRecords = [];
  for (const p of spec2.panels.filter((p2) => p2.id.startsWith("pant_"))) {
    const old = original[p.id], front = p.id.includes("_f_"), keys = waistKeys(p), length = keys.reduce((n, k) => n + edgeLength(old, k), 0), waistIds = keys.flatMap((k) => old.edges[k]), waistY = Math.min(...waistIds.map((i) => old.uvMm[i][1])), centerX = old.uvMm[waistIds.reduce((a, b) => Math.abs(old.uvMm[a][0]) > Math.abs(old.uvMm[b][0]) ? a : b)][0];
    const lowerSide = Object.values(old.edges).find((ids) => old.uvMm[ids[0]][0] === 0 && old.uvMm[ids.at(-1)][0] === 0);
    const hipY = Math.min(...lowerSide.map((i) => old.uvMm[i][1])), innerKey = { pant_f_l: "e8", pant_f_r: "e1", pant_b_l: "e1", pant_b_r: "e11" }[p.id], crotchY = Math.min(...old.edges[innerKey].map((i) => old.uvMm[i][1])), delta = waistEaseMm * fractions[front ? "front" : "back"] / 2;
    p.uvMm = old.uvMm.map(([x, y]) => {
      const f = Math.max(0, Math.min(1, (y - hipY) / (waistY - hipY)));
      return [x + (x - centerX) * delta / length * f, y + (y >= crotchY ? legDeltaMm * (y - crotchY) / -crotchY : 0)];
    });
    operationRecords.push({ panelId: p.id, legGradeBelowDatumMm: crotchY, waistGradeAboveDatumMm: hipY, waistNetAdditionMm: delta, mode: "piecewise-linear paper-coordinate grading; not 3D scale" });
  }
  if (waistEaseMm) {
    for (const p of spec2.panels.filter((p2) => p2.id.startsWith("wb_"))) {
      const old = original[p.id], front = p.id === "wb_front", topKey = front ? "e6" : "e0", seams = waistSeams.filter((s) => s.a.panelId === p.id).sort((a, b) => +a.a.edge.slice(1) - +b.a.edge.slice(1));
      const lengths = seams.map((s) => edgeLength(panels[s.b.panelId], s.b.edge) * edgeLength(old, s.a.edge) / edgeLength(original[s.b.panelId], s.b.edge));
      const top = edgeLength(old, topKey) + waistEaseMm * fractions[front ? "front" : "back"], bottom = lengths.reduce((a, b) => a + b, 0), h = 35, phi = (bottom - top) / h;
      if (phi <= 1e-3 || phi >= Math.PI) throw Error("\u8170\u5934\u5706\u5F27\u8D85\u51FA\u672C\u4F8B\u53EF\u652F\u6301\u8303\u56F4");
      const rt = top / phi, rb = rt + h, topIds = old.edges[topKey], xc = (old.uvMm[topIds[0]][0] + old.uvMm[topIds.at(-1)][0]) / 2;
      const point = (r, theta) => [xc + r * Math.sin(theta), r * Math.cos(theta) - rt * Math.cos(phi / 2)];
      const direction = front ? 1 : -1;
      let traveled = 0;
      for (let k = 0; k < seams.length; k++) {
        const ids = p.edges[seams[k].a.edge], length = lengths[k];
        ids.forEach((id, j) => {
          const t = (traveled + length * j / (ids.length - 1)) / bottom;
          p.uvMm[id] = point(rb, direction * (t - 0.5) * phi);
        });
        traveled += length;
      }
      const topDir = old.uvMm[topIds.at(-1)][0] > old.uvMm[topIds[0]][0] ? 1 : -1;
      topIds.forEach((id, j) => {
        p.uvMm[id] = point(rt, topDir * (j / (topIds.length - 1) - 0.5) * phi);
      });
      const other = Object.keys(p.edges).filter((k) => k !== topKey && !seams.some((s) => s.a.edge === k));
      for (const key of other) {
        const ids = p.edges[key], a = [...p.uvMm[ids[0]]], b = [...p.uvMm[ids.at(-1)]];
        ids.forEach((id, j) => p.uvMm[id] = a.map((x, k) => x + (b[k] - x) * j / (ids.length - 1)));
      }
    }
  }
  for (const s of spec2.seams) s.easeMm = edgeLength(panels[s.b.panelId], s.b.edge) - edgeLength(panels[s.a.panelId], s.a.edge);
  spec2.revision = 1;
  spec2.id = "kaopu-short-paper-" + legDeltaMm + "-" + waistEaseMm;
  spec2.source.onlineProgram = { id: PROGRAM, controls: { legDeltaMm, waistEaseMm }, operationRecords, meaning: "bounded own 2D grading of attributed six-panel teacher pattern; not complete official generator port", sourcePaperFingerprint: fingerprint(base) };
  return spec2;
}
function meshPaper(input, { step = 16 } = {}) {
  const spec2 = clone(input);
  for (const p of spec2.panels) {
    const boundary = p.boundary.map((i) => p.uvMm[i]), constraints = p.boundary.map((i, j) => [i, p.boundary[(j + 1) % p.boundary.length]]), xs = boundary.map((q) => q[0]), ys = boundary.map((q) => q[1]), xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys), count = p.uvMm.length;
    let row = 0;
    for (let y = ymin + step * Math.sqrt(3) / 4; y < ymax; y += step * Math.sqrt(3) / 2, row++) for (let x = xmin + step / 2 + row % 2 * step / 2; x < xmax; x += step) {
      const q = [x, y];
      if (inside(q, boundary) && constraints.every(([a, b]) => segDist(q, p.uvMm[a], p.uvMm[b]) > step * 0.42)) p.uvMm.push(q);
    }
    p.triangles = (0, import_cdt2d.default)(p.uvMm, constraints, { exterior: false }).map((t) => {
      const [a, b, c] = t.map((i) => p.uvMm[i]);
      return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0 ? t : [t[0], t[2], t[1]];
    });
    p.temporaryGuideMaterialIds = Array.from({ length: p.uvMm.length - count }, (_, i) => count + i);
    p.source.meshMethod = "cdt2d@1.0.0 MIT, 16 mm interior spacing; updated 2D boundaries retained";
  }
  spec2.source.meshing = { method: "cdt2d@1.0.0 MIT", interiorSpacingMm: step, baseCurveChordDeviationMm: 0.25, all28SourceStitchesRetained: true };
  validate(spec2);
  return spec2;
}
function paperSummary(spec2) {
  return { program: spec2.source.onlineProgram, panels: spec2.panels.length, seams: spec2.seams.length, waistTopMm: edgeLength(spec2.panels.find((p) => p.id === "wb_front"), "e6") + edgeLength(spec2.panels.find((p) => p.id === "wb_back"), "e0"), particleCount: spec2.panels.reduce((n, p) => n + p.uvMm.length, 0), triangleCount: spec2.panels.reduce((n, p) => n + p.triangles.length, 0), netMaterialAreaMm2: spec2.panels.reduce((n, p) => n + p.triangles.reduce((a, t) => {
    const [u, v, w] = t.map((i) => p.uvMm[i]);
    return a + Math.abs((v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0])) / 2;
  }, 0), 0) };
}

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/paper-program.mjs
var paper_program_exports2 = {};
__export(paper_program_exports2, {
  PROGRAM: () => PROGRAM2,
  edgeLength: () => edgeLength2,
  gradePaper: () => gradePaper2,
  meshPaper: () => meshPaper3,
  paperSummary: () => paperSummary2
});

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/core.mjs
var SCHEMA2 = "kaopu-sewing-graph@1";
var clone2 = (x) => JSON.parse(JSON.stringify(x));
var freeze = (o) => {
  if (o && typeof o === "object") {
    Object.values(o).forEach(freeze);
    Object.freeze(o);
  }
  return o;
};
var distance2 = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
var finite2 = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
var fail2 = (code, detail) => {
  throw new Error(`${code}: ${detail}`);
};
var len2 = (p, ids) => ids.slice(1).reduce((s, id, k) => s + distance2(p.uvMm[id], p.uvMm[ids[k]]), 0);
var cross2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
var on2 = (a, b, p) => Math.abs(cross2(a, b, p)) < 1e-7 && p[0] >= Math.min(a[0], b[0]) - 1e-7 && p[0] <= Math.max(a[0], b[0]) + 1e-7 && p[1] >= Math.min(a[1], b[1]) - 1e-7 && p[1] <= Math.max(a[1], b[1]) + 1e-7;
var intersect2 = (a, b, c, d) => cross2(a, b, c) * cross2(a, b, d) < 0 && cross2(c, d, a) * cross2(c, d, b) < 0 || on2(a, b, c) || on2(a, b, d) || on2(c, d, a) || on2(c, d, b);
function directedEdge2(spec2, end) {
  const p = spec2.panels.find((p2) => p2.id === end.panelId);
  if (!p) fail2("MISSING_PANEL", end.panelId);
  const ids = p.edges[end.edge];
  if (!ids) fail2("MISSING_EDGE", `${p.id}.${end.edge}`);
  return { panel: p, ids: end.reverse ? [...ids].reverse() : [...ids] };
}
function validate2(spec2) {
  if (!spec2 || spec2.schema !== SCHEMA2) fail2("SCHEMA", `expected ${SCHEMA2}`);
  if (spec2.units !== "mm") fail2("UNITS", "explicit millimetres required");
  if (!Number.isInteger(spec2.revision) || spec2.revision < 1) fail2("REVISION", "positive integer required");
  if (!Array.isArray(spec2.panels) || !spec2.panels.length || spec2.panels.length > 32) fail2("PANELS", "1\u201332 panels required");
  for (const key of ["panels", "materials", "seams", "stages"]) {
    if (!Array.isArray(spec2[key])) fail2("SCHEMA", `${key} array required`);
    const ids = spec2[key].map((p) => p.id);
    if (ids.some((x) => typeof x !== "string" || !x) || new Set(ids).size !== ids.length) fail2("DUPLICATE_ID", key);
  }
  if (spec2.acceptance?.productionReady !== false || spec2.acceptance?.fitValidated !== false) fail2("ACCEPTANCE", "learning input cannot pre-accept garment");
  let vertexCount = 0, triangleCount = 0;
  for (const m of spec2.materials) if (![m.densityKgM2, m.stretchCompliance, m.bendCompliance].every(Number.isFinite) || !(m.densityKgM2 > 0 && m.densityKgM2 < 10 && m.stretchCompliance >= 0 && m.bendCompliance >= 0) || m.calibrated !== false) fail2("MATERIAL", "uncalibrated finite positive demo material required");
  for (const p of spec2.panels) {
    if (!p.source?.version || !p.source?.kind) fail2("SOURCE", p.id);
    if (!spec2.materials.some((m) => m.id === p.materialId)) fail2("MATERIAL_REFERENCE", p.id);
    if (!Array.isArray(p.uvMm) || p.uvMm.length < 3 || p.uvMm.length > 3e3 || p.uvMm.some((x) => !finite2(x) || x.some((v) => Math.abs(v) > 2e3))) fail2("MATERIAL_COORDINATES", p.id);
    const indices = (ids) => Array.isArray(ids) && ids.length >= 2 && ids.every((i) => Number.isInteger(i) && i >= 0 && i < p.uvMm.length);
    if (!Array.isArray(p.triangles) || !p.triangles.length || p.triangles.length > 6e3) fail2("TRIANGLES", p.id);
    for (const tri of p.triangles) if (!indices(tri) || tri.length !== 3 || new Set(tri).size !== 3 || cross2(...tri.map((i) => p.uvMm[i])) <= 1e-7) fail2("TRIANGLE_AREA", p.id);
    const usedVertices = new Set(p.triangles.flat()), meshEdges = /* @__PURE__ */ new Map(), triIds = /* @__PURE__ */ new Set();
    for (const tri of p.triangles) {
      const key = [...tri].sort((a, b2) => a - b2).join(":");
      if (triIds.has(key)) fail2("DUPLICATE_TRIANGLE", p.id);
      triIds.add(key);
      for (let i = 0; i < 3; i++) {
        const key2 = [tri[i], tri[(i + 1) % 3]].sort((a, b2) => a - b2).join(":");
        meshEdges.set(key2, (meshEdges.get(key2) || 0) + 1);
      }
    }
    if (usedVertices.size !== p.uvMm.length) fail2("UNUSED_MATERIAL_POINT", p.id);
    if ([...meshEdges.values()].some((n) => n > 2)) fail2("NONMANIFOLD_MATERIAL", p.id);
    if (!indices(p.boundary) || new Set(p.boundary).size !== p.boundary.length) fail2("BOUNDARY", p.id);
    const b = p.boundary.map((i) => p.uvMm[i]);
    for (let i = 0; i < b.length; i++) for (let j = i + 2; j < b.length; j++) {
      if (i === 0 && j === b.length - 1) continue;
      if (intersect2(b[i], b[(i + 1) % b.length], b[j], b[(j + 1) % b.length])) fail2("BOUNDARY_INTERSECTION", p.id);
    }
    const cutEdges = new Set(p.boundary.map((a, i) => [a, p.boundary[(i + 1) % p.boundary.length]].sort((a2, b2) => a2 - b2).join(":")));
    for (const [key, count] of meshEdges) if (count === 1 !== cutEdges.has(key)) fail2("CUT_MESH_BOUNDARY", p.id);
    for (const key of cutEdges) if (meshEdges.get(key) !== 1) fail2("CUT_MESH_BOUNDARY", p.id);
    if (!p.edges || Object.values(p.edges).some((ids) => !indices(ids))) fail2("EDGES", p.id);
    for (const ids of Object.values(p.edges)) for (let i = 1; i < ids.length; i++) if (!meshEdges.has([ids[i - 1], ids[i]].sort((a, b2) => a - b2).join(":"))) fail2("SEAM_NOT_ON_MATERIAL", p.id);
    if (!p.placement || !Array.isArray(p.placement.translationMm) || p.placement.translationMm.length !== 3 || !p.placement.translationMm.every(Number.isFinite) || !Number.isFinite(p.placement.rotationYDeg)) fail2("PLACEMENT", p.id);
    if (!Array.isArray(p.temporaryPins) || p.temporaryPins.some((i) => !Number.isInteger(i) || i < 0 || i >= p.uvMm.length)) fail2("PINS", p.id);
    if (p.allowanceState !== "meshed_flat_unfolded" || !Number.isFinite(p.seamAllowanceMm) || p.seamAllowanceMm < 0) fail2("ALLOWANCE", p.id);
    vertexCount += p.uvMm.length;
    triangleCount += p.triangles.length;
  }
  const stages2 = new Map(spec2.stages.map((s) => [s.id, s])), visited = /* @__PURE__ */ new Set(), visiting = /* @__PURE__ */ new Set(), owners = [];
  function visit(id) {
    if (!stages2.has(id)) fail2("STAGE_REFERENCE", id);
    if (visiting.has(id)) fail2("STAGE_CYCLE", id);
    if (visited.has(id)) return;
    visiting.add(id);
    const s = stages2.get(id);
    if (!Array.isArray(s.requires) || !Array.isArray(s.seams)) fail2("STAGE_SCHEMA", id);
    s.requires.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  }
  for (const s of spec2.stages) {
    visit(s.id);
    for (const id of s.seams) {
      const seam = spec2.seams.find((x) => x.id === id);
      if (!seam || seam.stageId !== s.id) fail2("SEAM_STAGE", id);
      owners.push(id);
    }
  }
  if (owners.length !== spec2.seams.length || new Set(owners).size !== owners.length) fail2("SEAM_OWNERSHIP", "each seam belongs to one stage");
  const used = /* @__PURE__ */ new Set(), seamReports = [];
  for (const s of spec2.seams) {
    for (const endpoint of [s.a, s.b]) {
      if (typeof endpoint?.reverse !== "boolean") fail2("DIRECTION", "explicit edge direction required");
      const k = `${endpoint.panelId}:${endpoint.edge}`;
      if (used.has(k)) fail2("EDGE_REUSE", k);
      used.add(k);
    }
    const a = directedEdge2(spec2, s.a), b = directedEdge2(spec2, s.b), la = len2(a.panel, a.ids), lb = len2(b.panel, b.ids);
    if (la <= 0 || lb <= 0 || !Number.isFinite(s.easeMm) || Math.abs(lb - la - s.easeMm) > 0.1) fail2("EASE_LENGTH", `${s.id}: B\u2212A must match declared ease, not rescale rest geometry`);
    const sparse = spec2.source?.experimentalSparseSewing === true && s.numericalStitchPlan;
    if (sparse) {
      const pairs = s.stitchVertexPairs;
      if (!Array.isArray(pairs) || pairs.length < 2) fail2("SPARSE_STITCHES", s.id);
      let ai=-1, bi=-1;
      for (const pair of pairs) {
        if (!Array.isArray(pair)||pair.length!==2) fail2("SPARSE_PAIR",s.id);
        const ia=a.ids.indexOf(pair[0]),ib=b.ids.indexOf(pair[1]);
        if(ia<0||ib<0||ia<=ai||ib<=bi) fail2("SPARSE_DIRECTION",s.id);
        ai=ia;bi=ib;
      }
      if(pairs[0][0]!==a.ids[0]||pairs[0][1]!==b.ids[0]||pairs.at(-1)[0]!==a.ids.at(-1)||pairs.at(-1)[1]!==b.ids.at(-1))fail2("SPARSE_ENDPOINTS",s.id);
      if(!s.sourceSeam?.gathering||!Number.isFinite(s.sourceSeam.gathering.ruffleCoefficientA)||!Number.isFinite(s.sourceSeam.gathering.ruffleCoefficientB))fail2("ORIGINAL_GATHERING_REQUIRED",s.id);
    }
    if (Math.abs(s.easeMm) / la > 0.15 && !sparse) fail2("EASE_LIMIT", "demo supports up to 15% declared ease; R06 requires validated sparse stitch sites");
    if (!Array.isArray(s.notches) || s.notches.length < 2) fail2("NOTCHES", "two or more anchors required");
    if (!sparse && a.ids.length !== b.ids.length) fail2("SAMPLING", "R1 solver requires equal seam sample count; resampling is not implemented");
    for (const id of s.notches) {
      const na = a.panel.edgeNotches?.[s.a.edge]?.find((n) => n.id === id), nb = b.panel.edgeNotches?.[s.b.edge]?.find((n) => n.id === id);
      if (!na || !nb) fail2("NOTCH_REFERENCE", `${s.id}.${id}`);
      if (![na.t, nb.t].every((t) => Number.isFinite(t) && t >= 0 && t <= 1)) fail2("NOTCH_RANGE", s.id);
      const ta = s.a.reverse ? 1 - na.t : na.t, tb = s.b.reverse ? 1 - nb.t : nb.t;
      if (Math.abs(ta - tb) > 1e-6) fail2("NOTCH_DIRECTION", `${s.id}.${id}: oriented notches mismatch`);
    }
    seamReports.push({ id: s.id, lengthAMm: la, lengthBMm: lb, easeMm: lb - la, pairCount: a.ids.length });
  }
  return { valid: true, vertexCount, triangleCount, panelCount: spec2.panels.length, seams: seamReports, productionReady: false };
}
function fingerprint2(spec2) {
  let hash = 2166136261;
  for (const ch of JSON.stringify(spec2)) {
    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function cut(spec2) {
  validate2(spec2);
  return freeze({ schema: "kaopu-cut-snapshot@1", signature: fingerprint2(spec2), revision: spec2.revision, spec: clone2(spec2), productionReady: false });
}
var ClothLab = class {
  constructor(snapshot) {
    if (snapshot?.schema !== "kaopu-cut-snapshot@1" || snapshot.signature !== fingerprint2(snapshot.spec)) fail2("SNAPSHOT", "valid immutable cut snapshot required");
    validate2(snapshot.spec);
    this.snapshot = freeze(clone2(snapshot));
    this.spec = this.snapshot.spec;
    this.positions = [];
    this.previous = [];
    this.velocity = [];
    this.invMass = [];
    this.baseInvMass = [];
    this.offsets = /* @__PURE__ */ new Map();
    this.constraints = [];
    this.seamConstraints = [];
    this.triangles = [];
    this.pins = /* @__PURE__ */ new Map();
    this.completed = /* @__PURE__ */ new Set(["cut"]);
    this.active = /* @__PURE__ */ new Set();
    this.elapsed = 0;
    this.seamElapsed = 0;
    this.seamDetached = false;
    this.gravity = true;
    this.obstacle = false;
    this.pull = false;
    this.sphere = { center: [0, -0.025, -0.02], radius: 0.052 };
    this.floorY = -0.3;
    this.pullDirections = [];
    for (const p of this.spec.panels) {
      const start = this.positions.length;
      this.offsets.set(p.id, start);
      const theta = p.placement.rotationYDeg * Math.PI / 180, m = specMaterial(this.spec, p), mass = new Array(p.uvMm.length).fill(0), panelIndex = this.spec.panels.indexOf(p);
      for (const tri of p.triangles) {
        const area = cross2(...tri.map((i) => p.uvMm[i])) / 2e6;
        tri.forEach((i) => mass[i] += area * m.densityKgM2 / 3);
        this.triangles.push({ ids: tri.map((i) => start + i), uv: tri.map((i) => p.uvMm[i]), panelId: p.id });
      }
      for (let i = 0; i < p.uvMm.length; i++) {
        const [u, v] = p.uvMm[i], t = p.placement.translationMm;
        const point = [(u * Math.cos(theta) + t[0]) / 1e3, (t[1] - v) / 1e3, (u * Math.sin(theta) + t[2]) / 1e3];
        this.positions.push(point);
        this.previous.push([...point]);
        this.velocity.push([0, 0, 0]);
        this.invMass.push(1 / mass[i]);
        this.baseInvMass.push(1 / mass[i]);
        this.pullDirections.push(panelIndex === 0 ? -1 : panelIndex === this.spec.panels.length - 1 ? 1 : 0);
      }
      for (const i of p.temporaryPins) {
        this.pins.set(start + i, [...this.positions[start + i]]);
        this.invMass[start + i] = 0;
      }
      const edges = /* @__PURE__ */ new Map();
      for (const tri of p.triangles) for (let i = 0; i < 3; i++) {
        const a = tri[i], b = tri[(i + 1) % 3], key = [a, b].sort((a2, b2) => a2 - b2).join(":");
        if (!edges.has(key)) edges.set(key, { a, b, opposite: [] });
        edges.get(key).opposite.push(tri[(i + 2) % 3]);
      }
      for (const e of edges.values()) {
        this.constraints.push({ a: start + e.a, b: start + e.b, rest: distance2(p.uvMm[e.a], p.uvMm[e.b]) / 1e3, compliance: m.stretchCompliance, lambda: 0, type: "stretch" });
        if (e.opposite.length === 2) {
          const [a, b] = e.opposite;
          this.constraints.push({ a: start + a, b: start + b, rest: distance2(p.uvMm[a], p.uvMm[b]) / 1e3, compliance: m.bendCompliance, lambda: 0, type: "bend-distance-proxy" });
        }
      }
    }
  }
  assertCurrent(spec2) {
    if (fingerprint2(spec2) !== this.snapshot.signature) fail2("STALE_CUT", "pattern/material/placement changed: cut and sew again");
  }
  activate(stageId, current = this.spec) {
    this.assertCurrent(current);
    const stage = this.spec.stages.find((s) => s.id === stageId);
    if (!stage) fail2("STAGE_REFERENCE", stageId);
    if (stage.requires.some((id) => !this.completed.has(id))) fail2("STAGE_DEPENDENCY", stageId);
    if (this.completed.has(stageId)) return;
    for (const id of stage.seams) {
      const seam = this.spec.seams.find((s) => s.id === id), a = directedEdge2(this.spec, seam.a), b = directedEdge2(this.spec, seam.b);
      const pairs=this.spec.source?.experimentalSparseSewing?seam.stitchVertexPairs:a.ids.map((v,i)=>[v,b.ids[i]]);
      for (const pair of pairs) {
        const ia = this.offsets.get(a.panel.id) + pair[0], ib = this.offsets.get(b.panel.id) + pair[1];
        this.seamConstraints.push({ a: ia, b: ib, rest: 8e-4, startRest: distance2(this.positions[ia], this.positions[ib]), activatedAt: this.elapsed, compliance: 1e-8, lambda: 0, type: "seam", seamId: id });
      }
      this.active.add(id);
    }
    this.seamElapsed = 0;
    this.completed.add(stageId);
  }
  releasePins() {
    this.pins.clear();
    this.invMass = [...this.baseInvMass];
  }
  detach() {
    this.seamConstraints = [];
    this.active.clear();
    this.completed = /* @__PURE__ */ new Set(["cut"]);
    this.seamDetached = true;
  }
  step(dt = 1 / 60) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.05) fail2("TIMESTEP", "positive timestep up to 0.05 seconds required");
    const sub3 = 3, h = dt / sub3;
    for (let substep = 0; substep < sub3; substep++) {
      this.elapsed += h;
      this.seamElapsed += h;
      for (let i = 0; i < this.positions.length; i++) {
        this.previous[i] = [...this.positions[i]];
        if (!this.invMass[i]) continue;
        const v = this.velocity[i], p = this.positions[i];
        v[1] -= (this.gravity ? 9.81 : 0) * h;
        if (this.pull) v[0] += this.pullDirections[i] * 2.2 * h;
        for (let k = 0; k < 3; k++) p[k] += v[k] * h;
      }
      const constraints = [...this.constraints, ...this.seamConstraints];
      constraints.forEach((c) => c.lambda = 0);
      for (let iter = 0; iter < 12; iter++) {
        for (const c of constraints) {
          const a = this.positions[c.a], b = this.positions[c.b], w1 = this.invMass[c.a], w2 = this.invMass[c.b], dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2], d = Math.hypot(dx, dy, dz);
          if (d < 1e-12 || w1 + w2 === 0) continue;
          const alpha = c.compliance / (h * h), target = c.type === "seam" ? c.rest + (c.startRest - c.rest) * Math.max(0, 1 - (this.elapsed - c.activatedAt) / 1.2) : c.rest;
          const dl = (-(d - target) - alpha * c.lambda) / (w1 + w2 + alpha);
          c.lambda += dl;
          const f = dl / d;
          for (let k = 0; k < 3; k++) {
            const n = [dx, dy, dz][k];
            a[k] += w1 * f * n;
            b[k] -= w2 * f * n;
          }
        }
        for (let i = 0; i < this.positions.length; i++) {
          if (!this.invMass[i]) continue;
          const p = this.positions[i];
          p[1] = Math.max(this.floorY, p[1]);
          if (this.obstacle) {
            const c = this.sphere.center, d = distance2(p, c), r = this.sphere.radius + 1e-3;
            if (d < r) {
              const n = d > 1e-10 ? p.map((x, k) => (x - c[k]) / d) : [0, 0, 1];
              for (let k = 0; k < 3; k++) p[k] = c[k] + n[k] * r;
            }
          }
        }
      }
      const decay = Math.exp(-3 * h);
      for (let i = 0; i < this.positions.length; i++) for (let k = 0; k < 3; k++) this.velocity[i][k] = (this.positions[i][k] - this.previous[i][k]) / h * decay;
    }
  }
  metrics() {
    let maxStrain = 0, minRatio = 1, finite3 = true, maxSpeed = 0, penetration = 0;
    for (const t of this.triangles) {
      const [u0, u1, u2] = t.uv, du = u1[0] - u0[0], dv = u1[1] - u0[1], eu = u2[0] - u0[0], ev = u2[1] - u0[1], det = du * ev - dv * eu;
      const [p0, p1, p2] = t.ids.map((i) => this.positions[i]), f1 = [], f2 = [];
      for (let k = 0; k < 3; k++) {
        const a = (p1[k] - p0[k]) * 1e3, b = (p2[k] - p0[k]) * 1e3;
        f1.push((a * ev - b * dv) / det);
        f2.push((-a * eu + b * du) / det);
      }
      const aa = f1.reduce((s2, x) => s2 + x * x, 0), bb = f2.reduce((s2, x) => s2 + x * x, 0), ab = f1.reduce((s2, x, k) => s2 + x * f2[k], 0), disc = Math.sqrt((aa - bb) ** 2 + 4 * ab * ab);
      const large = Math.sqrt(Math.max(0, (aa + bb + disc) / 2)), small = Math.sqrt(Math.max(0, (aa + bb - disc) / 2));
      maxStrain = Math.max(maxStrain, large - 1, 1 - small);
      minRatio = Math.min(minRatio, small);
    }
    for (let i = 0; i < this.positions.length; i++) {
      finite3 &&= this.positions[i].every(Number.isFinite);
      maxSpeed = Math.max(maxSpeed, Math.hypot(...this.velocity[i]));
      if (this.obstacle) penetration = Math.max(penetration, (this.sphere.radius + 1e-3 - distance2(this.positions[i], this.sphere.center)) * 1e3);
    }
    const s = this.spec.seams.flatMap((seam) => {
      const a = directedEdge2(this.spec, seam.a), b = directedEdge2(this.spec, seam.b);
      const pairs=this.spec.source?.experimentalSparseSewing?seam.stitchVertexPairs:a.ids.map((v,i)=>[v,b.ids[i]]);return pairs.map(([id,other])=>distance2(this.positions[this.offsets.get(a.panel.id)+id],this.positions[this.offsets.get(b.panel.id)+other])*1e3);
    });
    return { finite: finite3, maxPrincipalStrain: maxStrain, minStretchRatio: minRatio, maxSeamGapMm: Math.max(0, ...s), meanSeamGapMm: s.reduce((a, b) => a + b, 0) / Math.max(1, s.length), maxSpeedMmS: maxSpeed * 1e3, maxVertexSpherePenetrationMm: Math.max(0, penetration), pins: this.pins.size, activeStitches: this.seamConstraints.length, vertexCount: this.positions.length, triangleCount: this.triangles.length, restSignature: this.snapshot.signature, elapsed: this.elapsed, bodyContact: "not_implemented", selfCollision: "not_implemented", productionReady: false };
  }
  export() {
    return { schema: "kaopu-cloth-experiment@1", snapshot: this.snapshot, positionsMm: this.positions.map((p) => p.map((x) => x * 1e3)), activeSeams: [...this.active], temporaryPins: [...this.pins.keys()], metrics: this.metrics(), solver: { type: "distance-XPBD", version: "r1", bending: "uncalibrated-distance-proxy", contacts: "vertex-sphere-and-floor-only", continuousCollision: false, selfCollision: false }, productionReady: false };
  }
};
function specMaterial(spec2, p) {
  return spec2.materials.find((m) => m.id === p.materialId);
}

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/paper-mesher.mjs
var import_cdt2d2 = __toESM(require_cdt2d(), 1);
var edgeLength2 = (p, key) => {
  const e = p.edges[key];
  return e.slice(1).reduce((n, id, j) => n + Math.hypot(...p.uvMm[id].map((x, k) => x - p.uvMm[e[j]][k])), 0);
};
var inside2 = (q, p) => {
  let yes = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if (a[1] > q[1] !== b[1] > q[1] && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
};
var segDist2 = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
function meshPaper2(input, { step = 16 } = {}) {
  const spec2 = clone2(input);
  for (const p of spec2.panels) {
    const boundary = p.boundary.map((i) => p.uvMm[i]), constraints = p.boundary.map((i, j) => [i, p.boundary[(j + 1) % p.boundary.length]]), xs = boundary.map((q) => q[0]), ys = boundary.map((q) => q[1]), xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys), count = p.uvMm.length;
    let row = 0;
    for (let y = ymin + step * Math.sqrt(3) / 4; y < ymax; y += step * Math.sqrt(3) / 2, row++) for (let x = xmin + step / 2 + row % 2 * step / 2; x < xmax; x += step) {
      const q = [x, y];
      if (inside2(q, boundary) && constraints.every(([a, b]) => segDist2(q, p.uvMm[a], p.uvMm[b]) > step * 0.42)) p.uvMm.push(q);
    }
    p.triangles = (0, import_cdt2d2.default)(p.uvMm, constraints, { exterior: false }).map((t) => {
      const [a, b, c] = t.map((i) => p.uvMm[i]);
      return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0 ? t : [t[0], t[2], t[1]];
    });
    p.temporaryGuideMaterialIds = Array.from({ length: p.uvMm.length - count }, (_, i) => count + i);
    p.source.meshMethod = "cdt2d@1.0.0 MIT, 16 mm interior spacing; updated 2D boundaries retained";
  }
  spec2.source.meshing = { method: "cdt2d@1.0.0 MIT", interiorSpacingMm: step, baseCurveChordDeviationMm: 0.25, allSourceStitchesRetained: true, sourceStitchCount: input.seams.length };
  validate2(spec2);
  return spec2;
}

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/paper-program.mjs
var PROGRAM2 = "kaopu-teacher-sleeveless-top-grading@1";
function gradePaper2(base, { bodyLengthDeltaMm = 0, hemEaseMm = 0 } = {}) {
  if (!Number.isFinite(bodyLengthDeltaMm) || bodyLengthDeltaMm < -50 || bodyLengthDeltaMm > 80 || !Number.isFinite(hemEaseMm) || hemEaseMm < 0 || hemEaseMm > 120) throw Error("\u672C\u4F8B\u652F\u6301\u8863\u957F \u221250\u2026+80 mm\u3001\u4E0B\u6446\u65B0\u589E\u677E\u91CF 0\u2026120 mm");
  const spec2 = clone2(base), records = [];
  for (const p of spec2.panels) {
    const old = base.panels.find((x) => x.id === p.id), side = spec2.seams.find((s) => s.stageId === "sides" && (s.a.panelId === p.id || s.b.panelId === p.id));
    if (!side) throw Error("\u4E0A\u8863\u4FA7\u7F1D\u7F3A\u5931");
    const endpoint = side.a.panelId === p.id ? side.a : side.b, datum = Math.min(...old.edges[endpoint.edge].map((i) => old.uvMm[i][1])), width = Math.max(...old.uvMm.map((q) => Math.abs(q[0]))), sign = p.source.side === "L" ? 1 : -1;
    p.uvMm = old.uvMm.map(([x, y]) => {
      const w = Math.max(0, Math.min(1, (y - datum) / -datum));
      return [x + sign * hemEaseMm / 4 * (Math.abs(x) / width) * w, y + bodyLengthDeltaMm * w];
    });
    records.push({ panelId: p.id, operation: "extend lower torso and spread the hem below the underarm datum", datumYmm: datum, lengthDeltaMm: bodyLengthDeltaMm, hemAdditionPerPanelMm: hemEaseMm / 4, unchanged: "neck, shoulder, complete armhole, and material above underarm datum" });
  }
  const panels = Object.fromEntries(spec2.panels.map((p) => [p.id, p]));
  for (const s of spec2.seams) s.easeMm = edgeLength2(panels[s.b.panelId], s.b.edge) - edgeLength2(panels[s.a.panelId], s.a.edge);
  spec2.id = `kaopu-sleeveless-top-${bodyLengthDeltaMm}-${hemEaseMm}`;
  spec2.revision = 1;
  spec2.source.onlineProgram = { id: PROGRAM2, controls: { bodyLengthDeltaMm, hemEaseMm }, operationRecords: records, sourcePaperFingerprint: fingerprint2(base), meaning: "bounded original 2D alterations of four-panel MIT teacher paper; fixed adult synthetic body; no solved 3D garment input" };
  return spec2;
}
function meshPaper3(input, options) {
  const s = meshPaper2(input, options);
  delete s.source.meshing.all28SourceStitchesRetained;
  s.source.meshing.sourceStitchCount = input.seams.length;
  s.source.meshing.allSourceStitchesRetained = s.seams.length === input.seams.length;
  return s;
}
function paperSummary2(spec2) {
  let area = 0, hem = 0;
  for (const p of spec2.panels) {
    for (const t of p.triangles) {
      const [a, b, c] = t.map((i) => p.uvMm[i]);
      area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
    }
    const maxY = Math.max(...p.uvMm.map((q) => q[1]));
    const h = Object.entries(p.edges).find(([, ids]) => ids.every((i) => Math.abs(p.uvMm[i][1] - maxY) < 1e-7));
    if (!h) throw Error("\u4E0B\u6446\u6C34\u5E73\u8FB9\u7F3A\u5931");
    hem += edgeLength2(p, h[0]);
  }
  return { program: spec2.source.onlineProgram, panels: spec2.panels.length, seams: spec2.seams.length, hemCircumferenceMm: hem, particleCount: spec2.panels.reduce((n, p) => n + p.uvMm.length, 0), triangleCount: spec2.panels.reduce((n, p) => n + p.triangles.length, 0), netMaterialAreaMm2: area };
}

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r05/src/paper-program.mjs
var paper_program_exports3 = {};
__export(paper_program_exports3, {
  PROGRAM: () => PROGRAM3,
  edgeLength: () => edgeLength3,
  gradePaper: () => gradePaper3,
  paperSummary: () => paperSummary3
});
var PROGRAM3 = "kaopu-short-sleeve-template-grading@1";
var edgeLength3 = (p, key) => {
  const ids = p.edges[key];
  return ids.slice(1).reduce((n, id, j) => n + Math.hypot(...p.uvMm[id].map((x, k) => x - p.uvMm[ids[j]][k])), 0);
};
function gradePaper3(base, { bodyLengthDeltaMm = 0, sleeveLengthDeltaMm = 0 } = {}) {
  if (!Number.isFinite(bodyLengthDeltaMm) || bodyLengthDeltaMm < -50 || bodyLengthDeltaMm > 80 || !Number.isFinite(sleeveLengthDeltaMm) || sleeveLengthDeltaMm < -30 || sleeveLengthDeltaMm > 50) throw Error("\u672C\u4F8B\u652F\u6301\u8863\u957F \u221250\u2026+80 mm\u3001\u8896\u957F \u221230\u2026+50 mm");
  const spec2 = clone2(base), records = [];
  for (const p of spec2.panels) {
    const old = base.panels.find((x) => x.id === p.id), role = p.source.role;
    if (role.startsWith("torso")) {
      const side = spec2.seams.find((s) => s.stageId === "sides" && (s.a.panelId === p.id || s.b.panelId === p.id)), e = side.a.panelId === p.id ? side.a : side.b, datum = Math.min(...old.edges[e.edge].map((i) => old.uvMm[i][1]));
      p.uvMm = bodyLengthDeltaMm ? old.uvMm.map(([x, y]) => [x, y + bodyLengthDeltaMm * Math.max(0, Math.min(1, (y - datum) / -datum))]) : old.uvMm.map((q) => [...q]);
      records.push({ panelId: p.id, datumYmm: datum, bodyLengthDeltaMm, operation: "grade every original material point below underarm datum; curved edges held fixed" });
    } else if (role.startsWith("sleeve")) {
      const caps = spec2.seams.filter((s) => s.stageId === "armholes" && (s.a.panelId === p.id || s.b.panelId === p.id)), ids = caps.flatMap((s) => {
        const e = s.a.panelId === p.id ? s.a : s.b;
        return old.edges[e.edge];
      }), datum = Math.min(...ids.map((i) => Math.abs(old.uvMm[i][0]))), direction = p.source.side === "L" ? 1 : -1;
      p.uvMm = sleeveLengthDeltaMm ? old.uvMm.map(([x, y]) => [x + direction * sleeveLengthDeltaMm * Math.max(0, Math.min(1, (datum - Math.abs(x)) / datum)), y]) : old.uvMm.map((q) => [...q]);
      records.push({ panelId: p.id, capNearestAbsoluteXmm: datum, sleeveLengthDeltaMm, operation: "extend distal straight sleeve material strip; complete source sleeve cap held fixed" });
    } else throw Error("Unknown material role");
    for (const key of Object.keys(p.analyticCurvesMm || {})) for (const id of p.edges[key]) if (Math.hypot(...p.uvMm[id].map((x, k) => x - old.uvMm[id][k])) > 1e-8) throw Error("Grading unexpectedly moved a protected analytic curve");
  }
  const panels = Object.fromEntries(spec2.panels.map((p) => [p.id, p]));
  for (const s of spec2.seams) s.easeMm = edgeLength3(panels[s.b.panelId], s.b.edge) - edgeLength3(panels[s.a.panelId], s.a.edge);
  let minimum = 180, area = 0;
  for (const p of spec2.panels) for (const t of p.triangles) {
    const q = t.map((i) => p.uvMm[i]), D = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]);
    if (D <= 1e-8) throw Error("\u4E8C\u7EF4\u653E\u7801\u4F7F\u6750\u6599\u4E09\u89D2\u5F62\u7FFB\u8F6C");
    area += D / 2;
    for (let i = 0; i < 3; i++) {
      const a = q[(i + 1) % 3].map((x, k) => x - q[i][k]), b = q[(i + 2) % 3].map((x, k) => x - q[i][k]);
      minimum = Math.min(minimum, Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b))))) * 180 / Math.PI);
    }
  }
  if (minimum < 15) throw Error("\u653E\u7801\u540E\u7F51\u683C\u8D28\u91CF\u8D85\u51FA\u672C\u4F8B\u9650\u5236");
  spec2.id = `kaopu-short-sleeve-${bodyLengthDeltaMm}-${sleeveLengthDeltaMm}`;
  spec2.revision = 1;
  spec2.source.onlineProgram = { id: PROGRAM3, controls: { bodyLengthDeltaMm, sleeveLengthDeltaMm }, sourcePaperFingerprint: fingerprint2(base), operationRecords: records, meaning: "bounded 2D material grading with fixed template connectivity; fresh solve from flat material, not new Delaunay or 3D scaling" };
  spec2.source.meshing = { ...spec2.source.meshing, onlineRemeshing: false, connectivityRetained: true, minimumGradedTriangleAngleDeg: minimum, gradedMaterialAreaMm2: area };
  validate2(spec2);
  return spec2;
}
function paperSummary3(s) {
  let hem = 0;
  for (const p of s.panels.filter((p2) => p2.source.role.startsWith("torso"))) {
    const ymax = Math.max(...p.uvMm.map((q) => q[1])), h = Object.entries(p.edges).find(([, ids]) => ids.every((i) => Math.abs(p.uvMm[i][1] - ymax) < 1e-7));
    if (!h) throw Error("Missing material hem");
    hem += edgeLength3(p, h[0]);
  }
  return { program: s.source.onlineProgram, panels: s.panels.length, seams: s.seams.length, hemCircumferenceMm: hem, particleCount: s.panels.reduce((n, p) => n + p.uvMm.length, 0), triangleCount: s.panels.reduce((n, p) => n + p.triangles.length, 0), netMaterialAreaMm2: s.source.meshing.gradedMaterialAreaMm2, minimumTriangleAngleDeg: s.source.meshing.minimumGradedTriangleAngleDeg, connectivityRetained: true };
}

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/stitch-groups.mjs
var StitchGroups = class {
  constructor(lab2) {
    this.lab = lab2;
    this.parent = lab2.positions.map((_, i) => i);
    this.representatives = [...this.parent];
    this.groupCount = this.parent.length;
    this.equalities = 0;
  }
  find(i) {
    return this.parent[i] === i ? i : this.parent[i] = this.find(this.parent[i]);
  }
  synchronize() {
    const l = this.lab;
    let changed = false;
    for (const c of l.seamConstraints) {
      if (c.eliminated || l.elapsed - c.activatedAt < c.rampDuration) continue;
      const a = this.find(c.a), b = this.find(c.b);
      if (a === b) {
        c.eliminated = true;
        continue;
      }
      const pa = l.positions[a], pb = l.positions[b], gap = Math.hypot(...pa.map((x, k) => x - pb[k]));
      if (gap > 2e-3) continue;
      this.parent[Math.max(a, b)] = Math.min(a, b);
      c.eliminated = true;
      this.equalities++;
      changed = true;
    }
    if (changed) this.rebuild();
    return changed;
  }
  rebuild() {
    const l = this.lab, groups = /* @__PURE__ */ new Map();
    for (let i = 0; i < this.parent.length; i++) {
      const r = this.find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(i);
    }
    this.representatives = [...groups.keys()];
    this.groupCount = groups.size;
    this.groups = groups;
    for (const [root2, ids] of groups) {
      let mass = 0;
      const p = [0, 0, 0], v = [0, 0, 0], pins = ids.filter((i) => l.pins.has(i));
      for (const i of ids) {
        const m = 1 / l.baseInvMass[i];
        mass += m;
        for (let k = 0; k < 3; k++) {
          p[k] += l.positions[i][k] * m;
          v[k] += l.velocity[i][k] * m;
        }
      }
      for (let k = 0; k < 3; k++) {
        p[k] = pins.length ? pins.reduce((sum, i) => sum + l.positions[i][k], 0) / pins.length : p[k] / mass;
        v[k] /= mass;
      }
      for (const i of ids) {
        l.positions[i] = p;
        l.velocity[i] = v;
        l.invMass[i] = pins.length ? 0 : 1 / mass;
      }
    }
  }
  report() {
    return { mode: "ideal-zero-width-stitch equality elimination", materialParticles: this.parent.length, solverGroups: this.groupCount, mergedEqualities: this.equalities, restMetricChanged: false, materialIdsPreserved: true, totalMaterialMassKg: this.lab.baseInvMass.reduce((s, w) => s + 1 / w, 0), fixedSolverGroups: this.representatives.filter((i) => this.lab.invMass[i] === 0).length };
  }
};

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/self-contact.mjs
var dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
var sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
var cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function closest(p, a, b, c, out) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  let u = 0, v = 0, w = 0;
  if (d1 <= 0 && d2 <= 0) u = 1;
  else {
    const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) v = 1;
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        v = d1 / (d1 - d3);
        u = 1 - v;
      } else {
        const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
        if (d6 >= 0 && d5 <= d6) w = 1;
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) {
            w = d2 / (d2 - d6);
            u = 1 - w;
          } else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
              w = (d4 - d3) / (d4 - d3 + (d5 - d6));
              v = 1 - w;
            } else {
              const den = 1 / (va + vb + vc);
              v = vb * den;
              w = vc * den;
              u = 1 - v - w;
            }
          }
        }
      }
    }
  }
  out[0] = a[0] * u + b[0] * v + c[0] * w;
  out[1] = a[1] * u + b[1] * v + c[1] * w;
  out[2] = a[2] * u + b[2] * v + c[2] * w;
  out[3] = u;
  out[4] = v;
  out[5] = w;
  return out;
}
var SelfContact = class {
  constructor(lab2, { thicknessMm = 0.6, cellSizeMm = 25 } = {}) {
    this.lab = lab2;
    this.h = thicknessMm / 1e3;
    this.cell = cellSizeMm / 1e3;
    this.neighbours = Array.from({ length: lab2.positions.length }, (_, i) => /* @__PURE__ */ new Set([i]));
    for (const [a, b] of lab2.meshEdges) {
      this.neighbours[a].add(b);
      this.neighbours[b].add(a);
    }
    this.hash = /* @__PURE__ */ new Map();
    this.q = new Float64Array(6);
    this.corrections = 0;
    this.skippedLargeTriangles = 0;
    this.groupNeighbours = null;
    this.lastGroupCount = -1;
  }
  key(x, y, z) {
    return x + 128 + 512 * (y + 128) + 262144 * (z + 128);
  }
  rebuild() {
    const l = this.lab;
    if (l.stitchEqualityElimination && this.lastGroupCount !== l.stitchGroups.groupCount) {
      this.groupNeighbours = /* @__PURE__ */ new Map();
      for (let i = 0; i < this.neighbours.length; i++) {
        const r = l.stitchGroups.find(i);
        if (!this.groupNeighbours.has(r)) this.groupNeighbours.set(r, /* @__PURE__ */ new Set());
        for (const j of this.neighbours[i]) this.groupNeighbours.get(r).add(l.stitchGroups.find(j));
      }
      this.lastGroupCount = l.stitchGroups.groupCount;
    }
    this.hash.clear();
    const ps = this.lab.positions, s = this.cell, pad = this.h * 3 + (this.lab.lastMaxSubstepDisplacement || 0) * 3;
    for (let t = 0; t < this.lab.triangles.length; t++) {
      const ids = this.lab.triangles[t].ids, a = ps[ids[0]], b = ps[ids[1]], c = ps[ids[2]];
      const x0 = Math.floor((Math.min(a[0], b[0], c[0]) - pad) / s), x1 = Math.floor((Math.max(a[0], b[0], c[0]) + pad) / s), y0 = Math.floor((Math.min(a[1], b[1], c[1]) - pad) / s), y1 = Math.floor((Math.max(a[1], b[1], c[1]) + pad) / s), z0 = Math.floor((Math.min(a[2], b[2], c[2]) - pad) / s), z1 = Math.floor((Math.max(a[2], b[2], c[2]) + pad) / s);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 3e3) {
        this.skippedLargeTriangles++;
        continue;
      }
      for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const key = this.key(x, y, z);
        let list = this.hash.get(key);
        if (!list) {
          list = [];
          this.hash.set(key, list);
        }
        list.push(t);
      }
    }
  }
  project() {
    const l = this.lab, ps = l.positions, im = l.invMass, h = this.h, q = this.q, s = this.cell;
    let total = 0;
    for (let i = 0; i < ps.length; i++) {
      if (l.stitchEqualityElimination && l.stitchGroups.find(i) !== i) continue;
      const p = ps[i], list = this.hash.get(this.key(Math.floor(p[0] / s), Math.floor(p[1] / s), Math.floor(p[2] / s)));
      if (!list) continue;
      const near = l.stitchEqualityElimination ? this.groupNeighbours.get(l.stitchGroups.find(i)) : this.neighbours[i];
      for (const t of list) {
        const ids = l.triangles[t].ids, topological = l.stitchEqualityElimination ? ids.map((j) => l.stitchGroups.find(j)) : ids;
        if (near.has(topological[0]) || near.has(topological[1]) || near.has(topological[2])) continue;
        const a = ps[ids[0]], b = ps[ids[1]], c = ps[ids[2]];
        closest(p, a, b, c, q);
        let dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2], len3 = Math.hypot(dx, dy, dz), n;
        const fn = cross3(sub(b, a), sub(c, a)), fnLen = Math.hypot(...fn);
        if (fnLen < 1e-15) continue;
        const N = fn.map((v) => v / fnLen), currentSigned = dot(sub(p, a), N), old = l._old, prevP = [old[i * 3], old[i * 3 + 1], old[i * 3 + 2]], oldA = [old[ids[0] * 3], old[ids[0] * 3 + 1], old[ids[0] * 3 + 2]], oldB = [old[ids[1] * 3], old[ids[1] * 3 + 1], old[ids[1] * 3 + 2]], oldC = [old[ids[2] * 3], old[ids[2] * 3 + 1], old[ids[2] * 3 + 2]], pn = cross3(sub(oldB, oldA), sub(oldC, oldA)), pnLen = Math.hypot(...pn), previousSigned = pnLen ? dot(sub(prevP, oldA), pn) / pnLen : currentSigned, projectedDistance = Math.hypot(dx - currentSigned * N[0], dy - currentSigned * N[1], dz - currentSigned * N[2]);
        const crossed = previousSigned * currentSigned < 0 && projectedDistance < h && pnLen > 1e-15 && dot(pn, N) > 0;
        if (len3 >= h && !crossed) continue;
        let penetration;
        if (crossed) {
          const side = previousSigned >= 0 ? 1 : -1;
          n = N.map((v) => v * side);
          penetration = h - side * currentSigned;
        } else if (len3 > 1e-9) {
          n = [dx / len3, dy / len3, dz / len3];
          penetration = h - len3;
        } else {
          n = N;
          if (previousSigned < 0) n = n.map((v) => -v);
          penetration = h;
        }
        let den = im[i];
        for (let k = 0; k < 3; k++) den += im[ids[k]] * q[k + 3] * q[k + 3];
        if (den < 1e-12) continue;
        const dl = penetration / den, fp = im[i] * dl;
        for (let k = 0; k < 3; k++) p[k] += n[k] * fp;
        for (let k = 0; k < 3; k++) {
          const v = ps[ids[k]], f = im[ids[k]] * q[k + 3] * dl;
          v[0] -= n[0] * f;
          v[1] -= n[1] * f;
          v[2] -= n[2] * f;
        }
        total++;
      }
    }
    this.corrections += total;
    return total;
  }
};

// tailor-unify-20261007/work/kaopu-tailor-workbench/unified/physics/reference-optimized.mjs
var norm3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
var BodySDF = class {
  constructor(meta, array) {
    this.meta = meta;
    this.a = array;
  }
  sample(x, y, z, out) {
    const m = this.meta, d = m.dimensions, ox = m.originMm, step = m.spacingMm, fx = (x * 1e3 - ox[0]) / step, fy = (y * 1e3 - ox[1]) / step, fz = (z * 1e3 - ox[2]) / step;
    if (fx < 0 || fy < 0 || fz < 0 || fx >= d[0] - 1 || fy >= d[1] - 1 || fz >= d[2] - 1) {
      out[0] = 1e3;
      out[1] = out[2] = out[3] = 0;
      out[4] = 0;
      return out;
    }
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz), u = fx - i, v = fy - j, w = fz - k, nx = d[0], ny = d[1], o = (k * ny + j) * nx + i, a = this.a;
    const p = a[o], q = a[o + 1], r = a[o + nx], s = a[o + nx + 1], t = a[o + nx * ny], b = a[o + nx * ny + 1], c = a[o + nx * ny + nx], e = a[o + nx * ny + nx + 1];
    const lo = (p * (1 - u) + q * u) * (1 - v) + (r * (1 - u) + s * u) * v, hi = (t * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v;
    out[0] = (lo * (1 - w) + hi * w) * m.quantizationMm * 1e-3;
    const dx = ((q - p) * (1 - v) + (s - r) * v) * (1 - w) + ((b - t) * (1 - v) + (e - c) * v) * w, dy = ((r - p) * (1 - u) + (s - q) * u) * (1 - w) + ((c - t) * (1 - u) + (e - b) * u) * w, dz = hi - lo, n = norm3(dx, dy, dz);
    out[1] = n ? dx / n : 0;
    out[2] = n ? dy / n : 1;
    out[3] = n ? dz / n : 0;
    out[4] = 1;
    return out;
  }
};
var GarmentLab = class extends ClothLab {
  constructor(spec2, sdf2, { substeps = 18, iterations = 3, sewingDuration = 4, clearanceMm = 3.5 } = {}) {
    super(cut(spec2));
    this.sdf = sdf2;
    this.substeps = substeps;
    this.iterations = iterations;
    this.sewingDuration = sewingDuration;
    this.clearance = clearanceMm * 1e-3;
    this.gravityScale = 0;
    this.collisions = true;
    this.bodyContacts = 0;
    this._q = new Float64Array(5);
    this._old = new Float64Array(this.positions.length * 3);
    this.support = [];
    this.orientationGuides = true;
    this.guideSigns = new Int8Array(this.positions.length);
    for (const p of this.spec.panels) {
      if (p.placement.rigidBasis) {
        const o = this.offsets.get(p.id), b = p.placement.rigidBasis, t = p.placement.translationMm;
        for (let j = 0; j < p.uvMm.length; j++) {
          const [u, v] = p.uvMm[j];
          this.positions[o + j] = [(b[0] * u + b[1] * v + t[0]) / 1e3, (b[3] * u + b[4] * v + t[1]) / 1e3, (b[6] * u + b[7] * v + t[2]) / 1e3];
          this.previous[o + j] = [...this.positions[o + j]];
        }
      }
      if (p.meshType === "unstructured") {
        const off = this.offsets.get(p.id);
        for (const i of p.temporaryGuideMaterialIds) this.guideSigns[off + i] = p.source.bodySide === "front" || p.id.includes("F") ? 1 : -1;
      } else if (p.id !== "G") {
        const off = this.offsets.get(p.id), isFront = p.id.includes("F"), cols = p.meshGrid?.columns ?? 13, rows = p.uvMm.length / cols, j0 = p.meshGrid?.guideRows[0] ?? 1, j1 = p.meshGrid?.guideRows[1] ?? rows - 2, i0 = p.meshGrid?.guideColumns[0] ?? 2, i1 = p.meshGrid?.guideColumns[1] ?? cols - 3;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.guideSigns[off + j * cols + i] = isFront ? 1 : -1;
      }
      for (const index of p.temporaryPins) {
        if (p.temporaryPinTargetsMm?.[index]) {
          const id2 = this.offsets.get(p.id) + index;
          this.support.push({ id: id2, start: [...this.positions[id2]], target: p.temporaryPinTargetsMm[index].map((x) => x / 1e3) });
          continue;
        }
        const id = this.offsets.get(p.id) + index, sign = p.id.endsWith("R") ? -1 : 1, start = [...this.positions[id]], waist = this.spec.source.measurementSnapshot.lowerWaist || this.spec.source.measurementSnapshot.waist;
        const isCenter = this.spec.source.waistFixtures && index === p.edges.waist[0], back = p.id.startsWith("B"), target = isCenter ? [sign * 4e-4, (this.spec.source.measurementSnapshot.waist.heightMm - this.spec.source.options.waistbandHeightMm) / 1e3, (back ? waist.backZ - 3.8 : waist.frontZ + 3.8) / 1e3] : [sign * (Math.abs(waist.sideRightXZ[0]) + 3.8) / 1e3, (this.spec.source.measurementSnapshot.waist.heightMm - this.spec.source.options.waistbandHeightMm) / 1e3, (waist.sideRightXZ[1] + (back ? -0.4 : 0.4)) / 1e3];
        this.support.push({ id, start, target });
      }
    }
    this.strainTriangles = this.triangles.map((t) => {
      const [a, b, c] = t.uv.map((x) => x.map((y) => y / 1e3)), du = b[0] - a[0], dv = b[1] - a[1], eu = c[0] - a[0], ev = c[1] - a[1], det = du * ev - dv * eu;
      return { ids: t.ids, c: [(dv - ev) / det, ev / det, -dv / det], d: [(eu - du) / det, -eu / det, du / det] };
    });
    this.meshEdges = [];
    const seen = /* @__PURE__ */ new Set();
    for (const t of this.triangles) for (let i = 0; i < 3; i++) {
      const a = t.ids[i], b = t.ids[(i + 1) % 3], key = a < b ? a + ":" + b : b + ":" + a;
      if (!seen.has(key)) {
        seen.add(key);
        this.meshEdges.push([a, b]);
      }
    }
    this.selfContacts = new SelfContact(this);
    this.selfCollisionEnabled = true;
    this.stitchGroups = new StitchGroups(this);
    this.stitchEqualityElimination = false;
    this.strainGuard = true;
    this.frameCount = 0;
    this.actions = [];
  }
  activate(stageId, current = this.spec) {
    const existed = this.completed.has(stageId);
    super.activate(stageId, current);
    if (!existed) this.actions.push({ kind: "sew-stage", stageId, atFrame: this.frameCount });
    for (const c of this.seamConstraints) if (c.rampDuration === void 0) c.rampDuration = this.sewingDuration;
  }
  detach() {
    super.detach();
    this.actions.push({ kind: "detach", atFrame: this.frameCount });
    this.positions = this.positions.map((p) => [...p]);
    this.velocity = this.velocity.map((p) => [...p]);
    this.invMass = this.baseInvMass.map((w, i) => this.pins.has(i) ? 0 : w);
    this.stitchGroups = new StitchGroups(this);
  }
  setGravity(scale) {
    this.gravityScale = scale;
    this.actions.push({ kind: "gravity", scale, atFrame: this.frameCount });
  }
  releasePins() {
    super.releasePins();
    this.actions.push({ kind: "release-supports", atFrame: this.frameCount });
    this.support = [];
    this.orientationGuides = false;
    if (this.stitchEqualityElimination) this.stitchGroups.rebuild();
  }
  contact(ids, weights, margin = this.clearance) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < ids.length; k++) {
      const p = this.positions[ids[k]], w = weights[k];
      x += p[0] * w;
      y += p[1] * w;
      z += p[2] * w;
    }
    const q = this.sdf.sample(x, y, z, this._q);
    if (!q[4] || q[0] >= margin) return;
    let sum = 0;
    for (let k = 0; k < ids.length; k++) sum += this.invMass[ids[k]] * weights[k] * weights[k];
    if (sum < 1e-12) return;
    const lambda = (margin - q[0]) / sum;
    for (let k = 0; k < ids.length; k++) {
      const p = this.positions[ids[k]], f = this.invMass[ids[k]] * weights[k] * lambda;
      p[0] += q[1] * f;
      p[1] += q[2] * f;
      p[2] += q[3] * f;
    }
    this.bodyContacts++;
  }
  strainLimit() {
    const ps = this.positions, im = this.invMass;
    for (const t of this.strainTriangles) {
      const [a, b, c] = t.ids, A = ps[a], B = ps[b], C = ps[c], u = t.c, w = t.d;
      let ux = A[0] * u[0] + B[0] * u[1] + C[0] * u[2], uy = A[1] * u[0] + B[1] * u[1] + C[1] * u[2], uz = A[2] * u[0] + B[2] * u[1] + C[2] * u[2], vx = A[0] * w[0] + B[0] * w[1] + C[0] * w[2], vy = A[1] * w[0] + B[1] * w[1] + C[1] * w[2], vz = A[2] * w[0] + B[2] * w[1] + C[2] * w[2];
      const aa = ux * ux + uy * uy + uz * uz, bb = vx * vx + vy * vy + vz * vz, ab = ux * vx + uy * vy + uz * vz;
      const radius = Math.abs(ab);
      if (Math.min(aa, bb) - radius >= 0.985 * 0.985 + 1e-12 && Math.max(aa, bb) + radius <= 1.015 * 1.015 - 1e-12) continue;
      const angle = 0.5 * Math.atan2(2 * ab, aa - bb), co = Math.cos(angle), si = Math.sin(angle);
      for (let mode = 0; mode < 2; mode++) {
        if (mode) {
          ux = A[0] * u[0] + B[0] * u[1] + C[0] * u[2];
          uy = A[1] * u[0] + B[1] * u[1] + C[1] * u[2];
          uz = A[2] * u[0] + B[2] * u[1] + C[2] * u[2];
          vx = A[0] * w[0] + B[0] * w[1] + C[0] * w[2];
          vy = A[1] * w[0] + B[1] * w[1] + C[1] * w[2];
          vz = A[2] * w[0] + B[2] * w[1] + C[2] * w[2];
        }
        const qx = mode ? -si : co, qy = mode ? co : si, nx = ux * qx + vx * qy, ny = uy * qx + vy * qy, nz = uz * qx + vz * qy, len3 = norm3(nx, ny, nz), target = Math.max(0.985, Math.min(1.015, len3));
        if (Math.abs(len3 - target) < 1e-6 || len3 < 1e-9) continue;
        const ca = u[0] * qx + w[0] * qy, cb = u[1] * qx + w[1] * qy, cc = u[2] * qx + w[2] * qy, den = im[a] * ca * ca + im[b] * cb * cb + im[c] * cc * cc;
        if (den < 1e-12) continue;
        const factor = -(len3 - target) / (den * len3), fa = im[a] * ca * factor, fb = im[b] * cb * factor, fc = im[c] * cc * factor;
        A[0] += fa * nx;
        A[1] += fa * ny;
        A[2] += fa * nz;
        B[0] += fb * nx;
        B[1] += fb * ny;
        B[2] += fb * nz;
        C[0] += fc * nx;
        C[1] += fc * ny;
        C[2] += fc * nz;
      }
    }
  }
  step(dt = 1 / 60) {
    this.frameCount++;
    const n = this.positions.length, h = dt / this.substeps, ps = this.positions, vs = this.velocity, im = this.invMass, q = this._q, old = this._old, all = [...this.constraints, ...this.seamConstraints];
    this.bodyContacts = 0;
    for (let sub3 = 0; sub3 < this.substeps; sub3++) {
      this.elapsed += h;
      this.seamElapsed += h;
      if (this.stitchEqualityElimination) this.stitchGroups.synchronize();
      for (const hold of this.support) {
        const p = ps[hold.id], t = Math.min(1, this.elapsed / 4), s = t * t * (3 - 2 * t);
        for (let k = 0; k < 3; k++) p[k] = hold.start[k] + (hold.target[k] - hold.start[k]) * s;
      }
      for (let i = 0; i < n; i++) {
        const p = ps[i], o = i * 3;
        old[o] = p[0];
        old[o + 1] = p[1];
        old[o + 2] = p[2];
      }
      for (let i = 0; i < n; i++) {
        if (this.stitchEqualityElimination && this.stitchGroups.find(i) !== i) continue;
        const p = ps[i], v = vs[i];
        if (!im[i]) continue;
        v[1] -= 9.81 * this.gravityScale * h;
        p[0] += v[0] * h;
        p[1] += v[1] * h;
        p[2] += v[2] * h;
      }
      for (const c of all) c.lambda = 0;
      for (let iter = 0; iter < this.iterations; iter++) {
        for (const c of all) {
          if (c.eliminated) continue;
          const a = ps[c.a], b = ps[c.b], w1 = im[c.a], w2 = im[c.b], dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2], len3 = norm3(dx, dy, dz);
          if (len3 < 1e-12 || w1 + w2 === 0) continue;
          const alpha = c.compliance / (h * h), target = c.type === "seam" ? c.rest + (c.startRest - c.rest) * Math.max(0, 1 - (this.elapsed - c.activatedAt) / c.rampDuration) : c.rest, dl = (-(len3 - target) - alpha * c.lambda) / (w1 + w2 + alpha), f = dl / len3;
          c.lambda += dl;
          a[0] += w1 * f * dx;
          a[1] += w1 * f * dy;
          a[2] += w1 * f * dz;
          b[0] -= w2 * f * dx;
          b[1] -= w2 * f * dy;
          b[2] -= w2 * f * dz;
        }
        if (this.strainGuard) this.strainLimit();
        if (this.orientationGuides) for (let i = 0; i < n; i++) {
          const sign = this.guideSigns[i];
          if (!sign || !im[i]) continue;
          const p = ps[i], y = p[1] * 1e3, m = this.spec.source.measurementSnapshot, split = y >= m.hip.heightMm ? m.hip.sideRightXZ[1] + (m.waist.sideRightXZ[1] - m.hip.sideRightXZ[1]) * Math.min(1, (y - m.hip.heightMm) / (m.waist.heightMm - m.hip.heightMm)) : 25, limit = (split + sign * 12) / 1e3;
          if (sign > 0 && p[2] < limit) p[2] = limit;
          if (sign < 0 && p[2] > limit) p[2] = limit;
        }
        if (this.collisions) for (let i = 0; i < n; i++) {
          if (!im[i]) continue;
          const p = ps[i];
          this.sdf.sample(p[0], p[1], p[2], q);
          if (q[4] && q[0] < this.clearance) {
            const d = this.clearance - q[0];
            p[0] += q[1] * d;
            p[1] += q[2] * d;
            p[2] += q[3] * d;
            this.bodyContacts++;
          }
        }
      }
      for (const c of this.seamConstraints) {
        if (c.eliminated) continue;
        const a = ps[c.a], b = ps[c.b], w1 = im[c.a], w2 = im[c.b], dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2], len3 = norm3(dx, dy, dz);
        if (len3 < 1e-12 || w1 + w2 === 0) continue;
        const target = c.rest + (c.startRest - c.rest) * Math.max(0, 1 - (this.elapsed - c.activatedAt) / c.rampDuration), alpha = c.compliance / (h * h), dl = (-(len3 - target) - alpha * c.lambda) / (w1 + w2 + alpha), f = dl / len3;
        c.lambda += dl;
        a[0] += w1 * f * dx;
        a[1] += w1 * f * dy;
        a[2] += w1 * f * dz;
        b[0] -= w2 * f * dx;
        b[1] -= w2 * f * dy;
        b[2] -= w2 * f * dz;
      }
      if (this.collisions && sub3 % 3 === 2) {
        for (const e of this.meshEdges) this.contact(e, [0.5, 0.5], 15e-4);
        for (const t of this.triangles) this.contact(t.ids, [1 / 3, 1 / 3, 1 / 3], 15e-4);
      }
      if (this.selfCollisionEnabled && sub3 % 3 === 2) {
        let maxDelta = 0;
        for (let i = 0; i < n; i++) {
          const p = ps[i], o = i * 3;
          maxDelta = Math.max(maxDelta, Math.hypot(p[0] - old[o], p[1] - old[o + 1], p[2] - old[o + 2]));
        }
        this.lastMaxSubstepDisplacement = maxDelta;
        this.selfContacts.rebuild();
        this.selfContacts.project();
      }
      const damping = Math.exp(-20 * h);
      for (let i = 0; i < n; i++) {
        if (this.stitchEqualityElimination && this.stitchGroups.find(i) !== i) continue;
        const p = ps[i], v = vs[i], o = i * 3;
        v[0] = (p[0] - old[o]) / h * damping;
        v[1] = (p[1] - old[o + 1]) / h * damping;
        v[2] = (p[2] - old[o + 2]) / h * damping;
        if (p[1] < 0) {
          p[1] = 0;
          v[1] = 0;
        }
      }
    }
  }
  metrics() {
    const m = super.metrics();
    let minBody = Infinity, bad = 0, domain = 0, minY = Infinity, maxY = -Infinity;
    const q = new Float64Array(5);
    for (const p of this.positions) {
      this.sdf.sample(...p, q);
      if (q[4]) {
        minBody = Math.min(minBody, q[0] * 1e3);
        if (q[0] < -5e-4) bad++;
      } else domain++;
      minY = Math.min(minY, p[1] * 1e3);
      maxY = Math.max(maxY, p[1] * 1e3);
    }
    const seams = this.spec.seams.map((s) => {
      const a = directedEdge2(this.spec, s.a), b = directedEdge2(this.spec, s.b), o1 = this.offsets.get(a.panel.id), o2 = this.offsets.get(b.panel.id);
      const pairs=this.spec.source?.experimentalSparseSewing?s.stitchVertexPairs:a.ids.map((v,i)=>[v,b.ids[i]]);
      const distances = pairs.map(([v,w]) => Math.hypot(...this.positions[o1 + v].map((x, k) => x - this.positions[o2 + w][k])) * 1e3);
      return { id: s.id, active: this.active.has(s.id), maxGapMm: Math.max(...distances), measurement: this.spec.source?.experimentalSparseSewing ? "numerical stitch sites, not every free gathering vertex" : "all paired edge vertices", stitchCount:pairs.length };
    });
    return { ...m, bodySignedDistanceMinMm: minBody, bodyInsideVertexCount: bad, outsideCollisionDomain: domain, minYmm: minY, maxYmm: maxY, seams, activeMaxGapMm: Math.max(0, ...seams.filter((s) => s.active).map((s) => s.maxGapMm)), temporarySupportCount: this.support.length, stitchEqualityElimination: this.stitchEqualityElimination ? this.stitchGroups.report() : false, gravityScale: this.gravityScale, temporaryOrientationGuides: this.orientationGuides, bodyContact: "grid-SDF from exact Anny triangle nearest distance; exact audit required", selfCollision: this.selfCollisionEnabled ? "discrete vertex-face, exact audit still required" : "disabled", selfContactCorrections: this.selfContacts.corrections, skippedSelfContactTriangles: this.selfContacts.skippedLargeTriangles };
  }
  export() {
    const m = this.metrics();
    return { ...super.export(), schema: "kaopu-garment-physical-trial@1", frameCount: this.frameCount, actions: this.actions, materialToSolverGroup: this.stitchEqualityElimination ? this.positions.map((_, i) => this.stitchGroups.find(i)) : this.positions.map((_, i) => i), metrics: m, solver: { ...super.export().solver, version: "garment-small-step-r1", contacts: "triangle-body-SDF vertex/edge/face samples and ground", strainGuard: this.strainGuard ? { kind: "per-iteration principal stretch clamp", min: 0.985, max: 1.015, acceptanceThreshold: false } : false, velocityDampingRate: 20, substeps: this.substeps, iterations: this.iterations, sewingDuration: this.sewingDuration, clearanceMm: this.clearance * 1e3, gravityScale: this.gravityScale, temporaryOrientationGuides: this.orientationGuides, bodyContact: "sampled triangle-mesh SDF + edge midpoint and face centroid projections", selfCollision: this.selfCollisionEnabled, stitchEqualities: this.stitchEqualityElimination ? this.stitchGroups.report() : false }, sourceBody: this.spec.source.measurementSnapshot.bodyId };
  }
};

// tailor-unify-20261007/work/kaopu-tailor-workbench/unified/physics/fast-solver.mjs
var module;
function configureWasm(bytes2) {
  module = new WebAssembly.Module(bytes2);
  return { bytes: bytes2.byteLength };
}
var GarmentLab2 = class extends GarmentLab {
  constructor(spec2, sdf2, options = {}) {
    super(spec2, sdf2, options);
    if (!module) throw Error("Fast kernel must be initialized before constructing cloth");
    this.kernel = new WebAssembly.Instance(module, { math: { atan2: Math.atan2, cos: Math.cos, sin: Math.sin } }).exports;
    this.profile = { distanceMs: 0, strainMs: 0, bodyVertexMs: 0, bodySurfaceMs: 0, integrateAndGroupsMs: 0 };
    const n = this.positions.length, t = this.strainTriangles.length, e = this.meshEdges.length, capacity = this.constraints.length + spec2.seams.reduce((s, x) => s + spec2.panels.find((p2) => p2.id === x.a.panelId).edges[x.a.edge].length, 0) + 16;
    this.capacity = capacity;
    let offset = 65536;
    const take = (count, bytes2 = 8) => {
      offset = Math.ceil(offset / 8) * 8;
      const p2 = offset;
      offset += count * bytes2;
      return p2;
    };
    this.ptr = { pos: take(n * 3), vel: take(n * 3), old: take(n * 3), inv: take(n), alias: take(n, 4), ci: take(capacity * 2, 4), cf: take(capacity * 10), ti: take(t * 3, 4), tf: take(t * 6), edges: take(e * 2, 4), sdf: take(sdf2.a.length, 2), rhs:take(n*3),sol:take(n*3),res:take(n*3),dir:take(n*3),ap:take(n*3),z:take(n*4),diag:take(n),qn:take(n*3*31),qgi:take(t*3*4,4),qgm:take(t*3),w43ids:take(n*2,4),w43spans:take(2,4),w43targets:take(1),w43scratch:take(n*3),b43ids:take(t*6,4),b43coeff:take(t*6),b43weights:take(t*2) };
    if (offset > 128 * 1024 * 1024) throw Error("Kernel material memory limit exceeded");
    const memory = this.kernel.memory;
    memory.grow(Math.ceil(offset / 65536) - memory.buffer.byteLength / 65536);
    const b = memory.buffer, p = this.ptr;
    this.posViews = Array.from({ length: n }, (_, i) => new Float64Array(b, p.pos + i * 24, 3));
    this.velViews = Array.from({ length: n }, (_, i) => new Float64Array(b, p.vel + i * 24, 3));
    this.weights = new Float64Array(b, p.inv, n);
    this.alias = new Int32Array(b, p.alias, n);
    this.ci = new Int32Array(b, p.ci, capacity * 2);
    this.cf = new Float64Array(b, p.cf, capacity * 10);
    this._old = new Float64Array(b, p.old, n * 3);
    const tids = new Int32Array(b, p.ti, t * 3), coefs = new Float64Array(b, p.tf, t * 6), edgeIds = new Int32Array(b, p.edges, e * 2), field = new Int16Array(b, p.sdf, sdf2.a.length);
    field.set(sdf2.a);
    sdf2.a = field;
    for (let i = 0; i < t; i++) {
      tids.set(this.strainTriangles[i].ids, i * 3);
      coefs.set([...this.strainTriangles[i].c, ...this.strainTriangles[i].d], i * 6);
    }
    for (let i = 0; i < e; i++) edgeIds.set(this.meshEdges[i], i * 2);
    const m = sdf2.meta;
    this.kernel.configure(p.pos, p.inv, p.alias, p.ci, p.cf, p.ti, p.tf, p.edges, p.sdf, n, 0, t, e, ...m.dimensions, ...m.originMm, m.spacingMm, m.quantizationMm);
    this.kernel.configureGlobal(p.rhs,p.sol,p.res,p.dir,p.ap,p.z,p.diag);
    this.packGroups();
    this.wrapRebuild();
    this.syncConstraints();
  }
  wrapRebuild() {
    const rebuild = this.stitchGroups.rebuild.bind(this.stitchGroups);
    this.stitchGroups.rebuild = () => {
      rebuild();
      this.packGroups();
    };
  }
  packGroups() {
    const positions = this.positions, velocity = this.velocity, weights = this.invMass;
    for (let i = 0; i < positions.length; i++) {
      const r = this.stitchGroups.find(i);
      this.alias[i] = r;
      this.posViews[r].set(positions[i]);
      this.velViews[r].set(velocity[i]);
      this.weights[i] = weights[i];
    }
    for (let i = 0; i < positions.length; i++) {
      positions[i] = this.posViews[this.alias[i]];
      velocity[i] = this.velViews[this.alias[i]];
    }
    this.invMass = this.weights;
  }
  syncConstraints() {
    const all = [...this.constraints, ...this.seamConstraints];
    if (all.length > this.capacity) throw Error("Constraint capacity exceeded");
    for (let i = 0; i < all.length; i++) {
      const c = all[i];
      this.ci[i * 2] = c.a;
      this.ci[i * 2 + 1] = c.b;
      this.cf.set([c.rest, c.compliance, c.startRest || 0, c.activatedAt || 0, c.rampDuration || 1, 0, c.eliminated ? 1 : 0, c.type === "seam" ? 1 : 0, 0, 0], i * 10);
    }
    this.count = all.length;
    this.kernel.setConstraintCount(all.length);
  }
  activate(stageId, current = this.spec) {
    super.activate(stageId, current);
    if (this.kernel) this.syncConstraints();
  }
  releasePins() {
    super.releasePins();
    if (!this.stitchEqualityElimination) this.packGroups();
  }
  detach() {
    super.detach();
    this.wrapRebuild();
    this.packGroups();
    this.syncConstraints();
  }
  step(dt = 1 / 60) {
    if (this.orientationGuides || this.selfCollisionEnabled) return super.step(dt);
    this.frameCount++;
    const n = this.positions.length, h = dt / this.substeps, ps = this.positions, vs = this.velocity, im = this.invMass, old = this._old, k = this.kernel, P = this.profile, baseCount = this.constraints.length;
    this.bodyContacts = 0;
    for (let sub3 = 0; sub3 < this.substeps; sub3++) {
      let now = performance.now();
      this.elapsed += h;
      this.seamElapsed += h;
      if (this.stitchEqualityElimination) this.stitchGroups.synchronize();
      for (let j = 0; j < this.seamConstraints.length; j++) this.cf[(baseCount + j) * 10 + 6] = this.seamConstraints[j].eliminated ? 1 : 0;
      for (const hold of this.support) {
        const p = ps[hold.id], t = Math.min(1, this.elapsed / .75), s = t * t * (3 - 2 * t);
        for (let axis = 0; axis < 3; axis++) p[axis] = hold.start[axis] + (hold.target[axis] - hold.start[axis]) * s;
      }
      for (let i = 0; i < n; i++) {
        const p = ps[i], o = i * 3;
        old[o] = p[0];
        old[o + 1] = p[1];
        old[o + 2] = p[2];
      }
      for (let i = 0; i < n; i++) {
        if (this.stitchEqualityElimination && this.alias[i] !== i) continue;
        const p = ps[i], v = vs[i];
        if (!im[i]) continue;
        v[1] -= 9.81 * this.gravityScale * h;
        p[0] += v[0] * h;
        p[1] += v[1] * h;
        p[2] += v[2] * h;
      }
      k.prepare(h, this.elapsed);
      P.integrateAndGroupsMs += performance.now() - now;
      for (let iter = 0; iter < this.iterations; iter++) {
        now = performance.now();
        k.distances(0, this.count);
        P.distanceMs += performance.now() - now;
        if (this.strainGuard) {
          now = performance.now();
          k.strains();
          P.strainMs += performance.now() - now;
        }
        if (this.collisions) {
          now = performance.now();
          k.vertices(this.clearance);
          P.bodyVertexMs += performance.now() - now;
        }
      }
      now = performance.now();
      k.distances(baseCount, this.count);
      P.distanceMs += performance.now() - now;
      if (this.collisions && sub3 % 3 === 2) {
        now = performance.now();
        k.surfaces();
        P.bodySurfaceMs += performance.now() - now;
      }
      const extraStart=performance.now();for(let extra=0;extra<3;extra++){k.strains();k.vertices(this.clearance);}P.extraProjectionMs=(P.extraProjectionMs||0)+performance.now()-extraStart;
      if(this.waistCircuit43)for(let j=0;j<32;j++){k.waistProject43(1);k.vertices(this.clearance);}
      this.bodyContacts += k.getContacts();
      now = performance.now();
      const damping = Math.exp(-20 * h);
      for (let i = 0; i < n; i++) {
        if (this.stitchEqualityElimination && this.alias[i] !== i) continue;
        const p = ps[i], v = vs[i], o = i * 3;
        v[0] = (p[0] - old[o]) / h * damping;
        v[1] = (p[1] - old[o + 1]) / h * damping;
        v[2] = (p[2] - old[o + 2]) / h * damping;
        if (p[1] < 0) {
          p[1] = 0;
          v[1] = 0;
        }
      }
      P.integrateAndGroupsMs += performance.now() - now;
    }
  }
  export() {
    const record = super.export();
    record.positionsMm = this.positions.map((p) => Array.from(p, (x) => x * 1e3));
    record.solver.execution = { backend: "R07-f64-algebraic-XPBD-plus-local-global", reducedIterations: true, reducedSubsteps: false, originalConstraintOrder: false, initialSubsteps:12, initialDistanceIterations:1, additionalStrainContactPasses:3, shortenedSewingStages:true, coupledRefinementIterations:1600, referenceEquivalent:false };
    return record;
  }
};

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/sdf-transport.mjs
async function decodeSDF(blob, meta) {
  if (!globalThis.DecompressionStream) throw Error("\u6B64\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u672C\u4F8B\u7684\u65E0\u635F\u8DDD\u79BB\u573A\u89E3\u538B");
  const bytes2 = await new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer(), delta = new Int16Array(bytes2);
  for (let i = 1; i < delta.length; i++) delta[i] = delta[i] + delta[i - 1] << 16 >> 16;
  if (bytes2.byteLength !== meta.transport.decodedBytes) throw Error("\u4EBA\u4F53\u8DDD\u79BB\u573A\u957F\u5EA6\u6821\u9A8C\u5931\u8D25");
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes2))].map((x) => x.toString(16).padStart(2, "0")).join("");
  if (hash !== meta.transport.decodedSha256) throw Error("\u4EBA\u4F53\u8DDD\u79BB\u573A\u5185\u5BB9\u6821\u9A8C\u5931\u8D25");
  return bytes2;
}

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/diagnostics.mjs
var dist = (q, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dy * t);
};
var pathDist = (q, p, ids) => Math.min(...ids.slice(1).map((id, i) => dist(q, p.uvMm[ids[i]], p.uvMm[id])));
function regionalStrain(spec2, positionsMm) {
  const groups = Object.fromEntries(["ordinary_interior", "ordinary_seam_band", "free_edge_band", "planned_ease_band", "dart_band"].map((k) => [k, []])), perTriangle = [], all = [];
  let offset = 0;
  for (const p of spec2.panels) {
    const paths = { dart: [], ease: [], ordinary: [] }, used = /* @__PURE__ */ new Set();
    for (const s of spec2.seams) {
      for (const e of [s.a, s.b]) if (e.panelId === p.id) {
        const ids = p.edges[e.edge], len3 = ids.slice(1).reduce((n, id, j) => n + Math.hypot(...p.uvMm[id].map((x, k) => x - p.uvMm[ids[j]][k])), 0), kind = s.a.panelId === s.b.panelId ? "dart" : Math.abs(s.easeMm) / len3 >= 0.02 ? "ease" : "ordinary";
        paths[kind].push(ids);
        used.add(e.edge);
      }
    }
    const free = Object.entries(p.edges).filter(([key]) => !used.has(key)).map(([, ids]) => ids);
    for (let ti = 0; ti < p.triangles.length; ti++) {
      const ids = p.triangles[ti], [a, b, c] = ids.map((i) => p.uvMm[i]), [A, B, C] = ids.map((i) => positionsMm[offset + i]), du = b[0] - a[0], dv = b[1] - a[1], eu = c[0] - a[0], ev = c[1] - a[1], det = du * ev - dv * eu, u = [0, 1, 2].map((k) => ((B[k] - A[k]) * ev - (C[k] - A[k]) * dv) / det), v = [0, 1, 2].map((k) => (-(B[k] - A[k]) * eu + (C[k] - A[k]) * du) / det), aa = u.reduce((n, x) => n + x * x, 0), bb = v.reduce((n, x) => n + x * x, 0), ab = u.reduce((n, x, k) => n + x * v[k], 0), dis = Math.hypot(aa - bb, 2 * ab), strain = Math.max(Math.abs(Math.sqrt(Math.max(0, (aa + bb + dis) / 2)) - 1), Math.abs(Math.sqrt(Math.max(0, (aa + bb - dis) / 2)) - 1)), centroid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3], near = (kind) => paths[kind].some((ids2) => pathDist(centroid, p, ids2) <= 16), region = near("dart") ? "dart_band" : near("ease") ? "planned_ease_band" : near("ordinary") ? "ordinary_seam_band" : free.some((ids2) => pathDist(centroid, p, ids2) <= 16) ? "free_edge_band" : "ordinary_interior";
      const row = { area: Math.abs(det) / 2, strain, panelId: p.id, triangle: ti, uvCentroidMm: centroid };
      groups[region].push(row);
      all.push(row);
      perTriangle.push(strain);
    }
    offset += p.uvMm.length;
  }
  const summarize = (rows) => {
    if (!rows.length) return null;
    const sorted = [...rows].sort((a, b) => a.strain - b.strain), area = rows.reduce((n2, r) => n2 + r.area, 0);
    let n = 0, p95 = 0;
    for (const r of sorted) {
      n += r.area;
      if (n >= area * 0.95) {
        p95 = r.strain;
        break;
      }
    }
    return { triangleCount: rows.length, areaMm2: area, maximumPercent: sorted.at(-1).strain * 100, p95AreaWeightedPercent: p95 * 100, areaOver5Percent: rows.filter((r) => r.strain > 0.05).reduce((n2, r) => n2 + r.area, 0) / area * 100, worst: sorted.slice(-8).reverse() };
  };
  return { metric: "original 2D UV principal stretch/compression; area weighted", thresholdMeaning: "5% diagnostic threshold, not official acceptance requirement", regionWidthMm: 16, allowanceModeled: false, all: summarize(all), ordinaryMaterial: summarize([...groups.ordinary_interior, ...groups.ordinary_seam_band, ...groups.free_edge_band]), regions: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, summarize(v)])), perTriangle };
}
function topology(spec2) {
  const offsets = /* @__PURE__ */ new Map();
  let n = 0;
  for (const p of spec2.panels) {
    offsets.set(p.id, n);
    n += p.uvMm.length;
  }
  const parent = Array.from({ length: n }, (_, i) => i), find = (i) => parent[i] === i ? i : parent[i] = find(parent[i]);
  for (const s of spec2.seams) {
    const get = (e) => {
      const p = spec2.panels.find((p2) => p2.id === e.panelId), ids = p.edges[e.edge].map((i) => i + offsets.get(p.id));
      return e.reverse ? ids.reverse() : ids;
    }, a = get(s.a), b = get(s.b);
    a.forEach((id, i) => parent[find(id)] = find(b[i]));
  }
  const edges = /* @__PURE__ */ new Map(), tris = [];
  for (const p of spec2.panels) for (const t of p.triangles) {
    const ids = t.map((i) => find(offsets.get(p.id) + i));
    tris.push(ids);
    for (let i = 0; i < 3; i++) {
      const key = [ids[i], ids[(i + 1) % 3]].sort((a, b) => a - b).join(":");
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  const boundary = [...edges].filter(([, n2]) => n2 === 1), adj = /* @__PURE__ */ new Map();
  for (const [k] of boundary) {
    const [a, b] = k.split(":").map(Number);
    for (const [x, y] of [[a, b], [b, a]]) {
      if (!adj.has(x)) adj.set(x, []);
      adj.get(x).push(y);
    }
  }
  let loops = 0;
  const seen = /* @__PURE__ */ new Set();
  for (const start of adj.keys()) if (!seen.has(start)) {
    loops++;
    const todo = [start];
    while (todo.length) {
      const x = todo.pop();
      if (seen.has(x)) continue;
      seen.add(x);
      todo.push(...adj.get(x));
    }
  }
  return { quotientOnly: true, boundaryLoops: loops, eulerCharacteristic: new Set(parent.map((_, i) => find(i))).size - edges.size + tris.length, nonManifoldEdges: [...edges.values()].filter((x) => x > 2).length, degenerateTriangles: tris.filter((x) => new Set(x).size < 3).length };
}

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/intersection-audit.mjs
var sub2 = (a, b) => a.map((v, k) => v - b[k]);
var dot2 = (a, b) => a.reduce((n, v, k) => n + v * b[k], 0);
var cross4 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function segmentTriangle(a, b, x, y, z) {
  const d = sub2(b, a), e1 = sub2(y, x), e2 = sub2(z, x), p = cross4(d, e2), det = dot2(e1, p);
  if (Math.abs(det) < 1e-10) return false;
  const inv = 1 / det, t = sub2(a, x), u = dot2(t, p) * inv;
  if (u < -1e-8 || u > 1 + 1e-8) return false;
  const q = cross4(t, e1), v = dot2(d, q) * inv;
  if (v < -1e-8 || u + v > 1 + 1e-8) return false;
  const at = dot2(e2, q) * inv;
  return at > 1e-7 && at < 1 - 1e-7;
}
function intersects(a, b) {
  for (let i = 0; i < 3; i++) if (segmentTriangle(a[i], a[(i + 1) % 3], ...b) || segmentTriangle(b[i], b[(i + 1) % 3], ...a)) return true;
  return false;
}
var overlaps = (a, b) => !a.lo.some((x, k) => x > b.hi[k] || a.hi[k] < b.lo[k]);
var bounds = (points) => ({ lo: [0, 1, 2].map((k) => Math.min(...points.map((p) => p[k]))), hi: [0, 1, 2].map((k) => Math.max(...points.map((p) => p[k]))) });
function mesh(positions, faces) {
  const triangles = faces.map((ids, id) => {
    const points = ids.map((i) => positions[i]);
    return { id, ids, points, ...bounds(points) };
  });
  function build(rows) {
    const lo = [0, 1, 2].map((k) => Math.min(...rows.map((r) => r.lo[k]))), hi = [0, 1, 2].map((k) => Math.max(...rows.map((r) => r.hi[k])));
    if (rows.length <= 8) return { lo, hi, rows };
    const axis = [0, 1, 2].sort((a, b) => hi[b] - lo[b] - (hi[a] - lo[a]))[0];
    rows.sort((a, b) => a.lo[axis] + a.hi[axis] - b.lo[axis] - b.hi[axis]);
    const mid = rows.length >> 1;
    return { lo, hi, left: build(rows.slice(0, mid)), right: build(rows.slice(mid)) };
  }
  return { triangles, root: build([...triangles]) };
}
function candidates(node, box, out) {
  if (!overlaps(node, box)) return;
  if (node.rows) {
    for (const row of node.rows) if (overlaps(row, box)) out.push(row);
  } else {
    candidates(node.left, box, out);
    candidates(node.right, box, out);
  }
}
function prepareBodyAudit(body2) {
  return mesh(body2.positionsMm, body2.triangles);
}
function strictIntersectionAudit(spec2, positionsMm, groups, bodyMesh) {
  let offset = 0;
  const faces = spec2.panels.flatMap((p) => {
    const f = p.triangles.map((t) => t.map((i) => i + offset));
    offset += p.uvMm.length;
    return f;
  }), cloth = mesh(positionsMm, faces), bodyFaces = [], selfPairs = [];
  for (const t of cloth.triangles) {
    const rows = [];
    candidates(bodyMesh.root, t, rows);
    if (rows.some((b) => intersects(t.points, b.points))) bodyFaces.push(t.id);
  }
  for (const t of cloth.triangles) {
    const rows = [];
    candidates(cloth.root, t, rows);
    for (const b of rows) {
      if (b.id <= t.id) continue;
      if (intersects(t.points, b.points)||coplanarPositiveOverlap(t.points,b.points)) selfPairs.push([t.id, b.id]);
    }
  }
  return { bodyIntersectingFaceCount: bodyFaces.length, bodyIntersectingFaces: bodyFaces, selfStrictTriangleIntersectionCount: selfPairs.length, selfPairs, coplanarOverlapChecked: true, continuousCollisionChecked: false, stitchedAdjacencyMapUsed: false, sharedPointPairExclusions:false, method: "independent final BVH + proper segment/triangle and positive-area coplanar overlap; no shared-point blanket exclusions" };
}

// garment-catalogue-assembly-20261007/src/analytic-mesher.mjs
var import_cdt2d3 = __toESM(require_cdt2d(), 1);
var clone3 = (x) => JSON.parse(JSON.stringify(x));
var distance3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
var edgeKey = (p, e) => `${p}:${e}`;
var segmentDistance = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy, t = den ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
var inside3 = (q, p) => {
  let yes = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if (a[1] > q[1] !== b[1] > q[1] && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
};
function curvePoint(panel, edge, t) {
  const [a, b] = edge.endpoints.map((i) => panel.verticesMm[i]);
  if (t === 0) return [...a];
  if (t === 1) return [...b];
  if (edge.kind === "line") return a.map((v, k) => v * (1 - t) + b[k] * t);
  if (edge.kind === "circle") {
    const q = edge.arc, angle = (q.startAngleDegrees + q.sweepDegrees * t) * Math.PI / 180;
    return [q.centerMm[0] + q.radiusMm * Math.cos(angle), q.centerMm[1] + q.radiusMm * Math.sin(angle)];
  }
  const pts = [a, ...edge.controlPointsMm, b].map((p) => [...p]);
  for (let count = pts.length - 1; count > 0; count--) for (let i = 0; i < count; i++) for (let k = 0; k < 2; k++) pts[i][k] = pts[i][k] * (1 - t) + pts[i + 1][k] * t;
  return pts[0];
}
function curveTable(panel, edge) {
  const n = edge.kind === "line" ? 1 : Math.max(32, Math.ceil(edge.lengthMm / 0.4)), points = [], lengths = [0];
  for (let i = 0; i <= n; i++) {
    points.push(curvePoint(panel, edge, i / n));
    if (i) lengths.push(lengths.at(-1) + distance3(points[i - 1], points[i]));
  }
  const total = lengths.at(-1);
  function at(f) {
    if (f === 0 || f === 1) return curvePoint(panel, edge, f);
    const target = f * total;
    let lo = 0, hi = n;
    while (hi - lo > 1) {
      const m = lo + hi >> 1;
      if (lengths[m] < target) lo = m;
      else hi = m;
    }
    const t = (lo + (target - lengths[lo]) / (lengths[hi] - lengths[lo])) / n;
    return curvePoint(panel, edge, t);
  }
  function error(count) {
    let maximum = 0;
    for (let i = 0; i <= n; i++) {
      const fraction = lengths[i] / total, j = Math.min(count - 1, Math.floor(fraction * count));
      maximum = Math.max(maximum, segmentDistance(points[i], at(j / count), at((j + 1) / count)));
    }
    return maximum;
  }
  return { at, error, total, denseSegments: n };
}
function worldPoint(panel, point) {
  const b = panel.placement.matrix3, t = panel.placement.translationMm;
  return b.map((row, i) => row[0] * point[0] + row[1] * point[1] + t[i]);
}
function classifyStage(seam, panels) {
  const a = seam.a.panelId, b = seam.b.panelId;
  if (seam.isDart || a === b) return "darts";
  if (/wb_|waistband/.test(a + " " + b)) return "waist";
  if (a.includes("pant") && b.includes("pant")) return a.includes("_f_") && b.includes("_f_") || a.includes("_b_") && b.includes("_b_") ? "rises" : "legs";
  if (a.includes("sleeve") && b.includes("sleeve")) return "sleeve_tubes";
  if (a.includes("sleeve") || b.includes("sleeve")) return "armholes";
  if (a.includes("torso") && b.includes("torso")) {
    if (a.includes("ftorso") && b.includes("ftorso") || a.includes("btorso") && b.includes("btorso")) return "centers";
    const pa = panels.get(a), pb = panels.get(b), ea = pa.edges[seam.a.edge], eb = pb.edges[seam.b.edge], ends = [...ea.endpoints.map((i) => worldPoint(pa, pa.verticesMm[i])), ...eb.endpoints.map((i) => worldPoint(pb, pb.verticesMm[i]))], span = Math.max(...ends.map((p) => p[1])) - Math.min(...ends.map((p) => p[1]));
    return span < Math.min(seam.lengthAMm, seam.lengthBMm) * 0.8 ? "shoulders" : "sides";
  }
  return "shell";
}
function compileAnalytic(input, { interiorStepMm = 16, boundaryStepMm = 16, chordToleranceMm = 0.25, measurementSnapshot, allowUnsupportedSeams = false, numericalStitchSpacingMm = null } = {}) {
  if (input.schema !== "kaopu-analytic-sewing-pattern@1" || input.units !== "mm") throw Error("Expected millimetre analytic sewing pattern");
  if (input.validation?.analytic2DPass !== true) throw Error("Source 2D validity failed; refusing material generation");
  if (![interiorStepMm, boundaryStepMm, chordToleranceMm].every((x) => Number.isFinite(x) && x > 0)) throw Error("Positive mesh controls required");
  if (numericalStitchSpacingMm !== null && (!Number.isFinite(numericalStitchSpacingMm) || numericalStitchSpacingMm <= 0)) throw Error("Positive numerical stitch spacing required");
  const sourcePanels = new Map(input.panels.map((p) => [p.id, p])), tables = /* @__PURE__ */ new Map(), counts = /* @__PURE__ */ new Map(), needleIntervals = /* @__PURE__ */ new Map(), edgeDiagnostics = [];
  for (const p of input.panels) for (const e of p.edges) {
    const key = edgeKey(p.id, e.index), table = curveTable(p, e);
    tables.set(key, table);
    let count = Math.max(1, Math.ceil(table.total / boundaryStepMm));
    while (table.error(count) > chordToleranceMm) {
      count *= 2;
      if (count > 4096) throw Error("Curve sampling budget exceeded");
    }
    counts.set(key, count);
  }
  for (const s of input.seams) {
    const ka = edgeKey(s.a.panelId, s.a.edge), kb = edgeKey(s.b.panelId, s.b.edge);
    let count = Math.max(counts.get(ka), counts.get(kb));
    if (numericalStitchSpacingMm !== null && requiresGatheredStitchSites(s)) {
      const intervals=Math.max(1,Math.ceil(Math.min(s.lengthAMm,s.lengthBMm)/numericalStitchSpacingMm));
      const subA=Math.max(s.lengthAMm>s.lengthBMm?3:1,Math.ceil(counts.get(ka)/intervals));
      const subB=Math.max(s.lengthBMm>s.lengthAMm?3:1,Math.ceil(counts.get(kb)/intervals));
      counts.set(ka,intervals*subA);counts.set(kb,intervals*subB);
      needleIntervals.set(s.id,{intervals,subdivisions:Math.max(subA,subB),subA,subB});continue;
    }
    counts.set(ka, count);
    counts.set(kb, count);
  }
  const panels = input.panels.map((p) => {
    const uvMm = clone3(p.verticesMm), boundary = [], edges = {}, edgeNotches = {};
    for (const e of p.edges) {
      const key = edgeKey(p.id, e.index), table = tables.get(key), count = counts.get(key), ids = [e.endpoints[0]];
      for (let i = 1; i < count; i++) {
        ids.push(uvMm.length);
        uvMm.push(table.at(i / count));
      }
      ids.push(e.endpoints[1]);
      edges[e.id] = ids;
      boundary.push(...ids.slice(0, -1));
      edgeNotches[e.id] = [];
      const polylineLengthMm = ids.slice(1).reduce((n, id, i) => n + distance3(uvMm[ids[i]], uvMm[id]), 0);
      edgeDiagnostics.push({ panelId: p.id, edge: e.id, kind: e.kind, segments: count, analyticLengthMm: e.lengthMm, denseLengthMm: table.total, polylineLengthMm, chordDeviationMm: table.error(count) });
    }
    const constraints = boundary.map((i, j) => [i, boundary[(j + 1) % boundary.length]]), poly = boundary.map((i) => uvMm[i]), xs = poly.map((p2) => p2[0]), ys = poly.map((p2) => p2[1]), xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys), boundaryCount = uvMm.length;
    let row = 0;
    for (let y = ymin + interiorStepMm * Math.sqrt(3) / 4; y < ymax; y += interiorStepMm * Math.sqrt(3) / 2, row++) for (let x = xmin + interiorStepMm / 2 + row % 2 * interiorStepMm / 2; x < xmax; x += interiorStepMm) {
      const q = [x, y];
      if (inside3(q, poly) && constraints.every(([a, b]) => segmentDistance(q, uvMm[a], uvMm[b]) > interiorStepMm * 0.42)) uvMm.push(q);
    }
    const triangles = (0, import_cdt2d3.default)(uvMm, constraints, { exterior: false }).map((t) => {
      const [a, b, c] = t.map((i) => uvMm[i]);
      return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0 ? t : [t[0], t[2], t[1]];
    });
    return { id: p.id, source: { kind: "official-GarmentCode-live-analytic-paper", version: input.source.commit, commit: input.source.commit, license: input.source.license, originalPanelId: p.id, bodySide: /back|btorso|_b(?:_|$)/.test(p.id) ? "back" : "front", originalPlacement: clone3(p.placement), meshMethod: "cdt2d@1.0.0; analytic curve arc-length samples" }, materialId: "digital-muslin", uvMm, triangles, boundary, edges, edgeNotches, grain: [0, 1], grainMeaning: "adapter convention local +Y; upstream supplied no grain field", seamAllowanceMm: 0, allowanceState: "meshed_flat_unfolded", placement: { translationMm: [...p.placement.translationMm], rigidBasis: p.placement.matrix3.flat(), rotationYDeg: 0 }, temporaryPins: [], temporaryPinTargetsMm: {}, temporaryGuideMaterialIds: Array.from({ length: uvMm.length - boundaryCount }, (_, i) => boundaryCount + i), meshType: "unstructured", analyticCurvesMm: clone3(p.edges), originalVertexCount: p.verticesMm.length };
  });
  const byId = new Map(panels.map((p) => [p.id, p])), unsupportedSeams = [];
  const seams = input.seams.map((s) => {
    const a = { ...s.a, edge: "e" + s.a.edge }, b = { ...s.b, edge: "e" + s.b.edge }, pa = byId.get(a.panelId), pb = byId.get(b.panelId), length = (p, e) => p.edges[e].slice(1).reduce((n, id, i) => n + distance3(p.uvMm[p.edges[e][i]], p.uvMm[id]), 0), la = length(pa, a.edge), lb = length(pb, b.edge), notches = [`${s.id}:start`, `${s.id}:end`];
    for (const [p, e] of [[pa, a], [pb, b]]) p.edgeNotches[e.edge] = notches.map((id, i) => ({ id, t: e.reverse ? 1 - i : i, meaning: "algorithmic stitch endpoint, not an upstream tailoring notch" }));
    if (Math.abs(lb - la) / la > 0.15 + 1e-9) unsupportedSeams.push({ id: s.id, ratioBOverA: lb / la, gathering: clone3(s.gathering), reason: "Original ideal dense stitch model is limited to 15%; sparse gathering stitches required" });
    const needle = needleIntervals.get(s.id), oriented = (p, e) => e.reverse ? [...p.edges[e.edge]].reverse() : p.edges[e.edge], aa = oriented(pa, a), bb = oriented(pb, b), samples = needle ? Array.from({ length: needle.intervals + 1 }, (_, i) => i * needle.subdivisions) : aa.map((_, i) => i), stitchVertexPairs = needle ? Array.from({length:needle.intervals+1},(_,i)=>[aa[i*needle.subA],bb[i*needle.subB]]) : samples.map((i) => [aa[i], bb[i]]);
    return { id: s.id, a, b, easeMm: lb - la, notches, stageId: classifyStage(s, sourcePanels), sourceStitchIndex: s.sourceStitchIndex, sourceSeam: clone3(s), seamModel: needle ? "separate sparse numerical stitch samples; intervening material remains free" : "ideal zero-width equality after progressive closure", stitchVertexPairs, numericalStitchPlan: needle ? { ...needle, targetSpacingMm: numericalStitchSpacingMm, physicalSewingNeedleSpacing: false, restMaterialRescaled: false, fullMaterialEdgeSampleCount: aa.length, materialEdgeSampleCountA:aa.length,materialEdgeSampleCountB:bb.length, intermediateMaterialVerticesPerIntervalA:needle.subA-1,intermediateMaterialVerticesPerIntervalB:needle.subB-1 } : null, analyticEaseDefinition: "upstream A-B; current solver stores sampled B-A; original preserved in sourceSeam" };
  });
  const order = ["darts", "centers", "rises", "legs", "sleeve_tubes", "shoulders", "armholes", "sides", "shell", "waist"], activeOrder = order.filter((id) => seams.some((s) => s.stageId === id));
  const stages2 = [{ id: "cut", requires: [], seams: [] }, ...activeOrder.map((id, i) => ({ id, requires: [i ? activeOrder[i - 1] : "cut"], seams: seams.filter((s) => s.stageId === id).map((s) => s.id) }))];
  const spec2 = { schema: "kaopu-sewing-graph@1", id: `catalogue-${input.geometryHash}`, revision: 1, units: "mm", purpose: "live_official_pattern_to_original_cloth_solver", source: { kind: "GarmentCode MIT live analytic pattern", experimentalSparseSewing: numericalStitchSpacingMm !== null, commit: input.source.commit, recipeHash: input.recipeHash, geometryHash: input.geometryHash, bodyMeasurements: clone3(input.bodyCm), measurementSnapshot: clone3(measurementSnapshot || {}), bodyId: measurementSnapshot?.bodyId || "not-selected", options: {}, assemblyExperiment: activeOrder, officialPanelCount: panels.length, officialStitchCount: seams.length, meshing: { method: "cdt2d@1.0.0", interiorSpacingMm: interiorStepMm, boundaryMaximumNominalStepMm: boundaryStepMm, chordToleranceMm, restMetric: "original analytic paper coordinates; no seam-length normalization", edgeDiagnostics }, generationSource: clone3(input.source), analyticInputValidation: clone3(input.validation) }, materials: [{ id: "digital-muslin", densityKgM2: 0.2, stretchCompliance: 1e-7, bendCompliance: 20, calibrated: false }], panels, seams, stages: stages2, acceptance: { productionReady: false, fitValidated: false }, adapterDiagnostics: { unsupportedSeams, solverCompatible: unsupportedSeams.length === 0 } };
  if (unsupportedSeams.length) validate2({ ...spec2, seams: [], stages: [{ id: "cut", requires: [], seams: [] }] });
  if (unsupportedSeams.length && !allowUnsupportedSeams) {
    const error = new Error(`GATHERING_MODEL_REQUIRED: ${unsupportedSeams.map((s) => s.id).join(", ")}`);
    error.diagnosticSpec = spec2;
    throw error;
  }
  if (!unsupportedSeams.length) validate2(spec2);
  return spec2;
}

// garment-catalogue-assembly-20261007/src/workbench-worker.mjs
var root;
var patternBase;
var engine;
var config;
var spec;
var analytic;
var lab;
var sdf;
var bodyAudit;
var body;
var requestId = 0;
var epoch = 0;
var running = false;
var stageIndex = 0;
var stageFrame = 0;
var stages = [];
var totalFrames = 0;
var runStarted = 0;
var wallMs = 0;
var lastPacket = 0;
var kernelReady = false;
var pendingPause = false;
var refinementSteps=0,layerGuide=null,jointSteps=0,jointInfo=null,closureInfo=null;
var cachedBodyURL;
var cachedSDFURL;
var profile = { pythonMs: 0, meshMs: 0, bodyMs: 0, solveMs: 0, auditMs: 0, packetMs: 0 };
var emit = (type, data = {}, transfer = []) => postMessage({ requestId, ...data, type, binding:nativeBinding }, transfer);
var url = (p) => new URL(p, root).href;
async function json(path) {
  const r = await fetch(url(path));
  if (!r.ok) throw Error(`HTTP ${r.status}: ${path}`);
  return r.json();
}
async function bytes(path) {
  const r = await fetch(url(path));
  if (!r.ok) throw Error(`HTTP ${r.status}: ${path}`);
  return r.arrayBuffer();
}
function stop() {
  if (running) wallMs += performance.now() - runStarted;
  running = false;
  epoch++;
}
function initialPositions(paper) {
  const flat = new Float32Array(paper.panels.reduce((n, p) => n + p.uvMm.length * 3, 0));
  let i = 0;
  for (const p of paper.panels) {
    const b = p.placement.rigidBasis, t = p.placement.translationMm;
    for (const [u, v] of p.uvMm) {
      flat[i++] = (b[0] * u + b[1] * v + t[0]) / 1e3;
      flat[i++] = (b[3] * u + b[4] * v + t[1]) / 1e3;
      flat[i++] = (b[6] * u + b[7] * v + t[2]) / 1e3;
    }
  }
  return flat;
}
async function material(data, token) {
  if (data.kind === "legacy") {
    const programs = { shorts: paper_program_exports, sleeveless: paper_program_exports2, shortsleeve: paper_program_exports3 }, program = programs[data.caseId];
    if (!program) throw Error("Unknown accepted garment");
    const base = await json(data.directory + "/assets/teacher-paper-base.json");
    if (token !== epoch) return;
    const start2 = performance.now(), graded = program.gradePaper(base, data.controls), paper2 = program.meshPaper ? program.meshPaper(graded) : graded;
    profile.meshMs = performance.now() - start2;
    return { paper: paper2, sourcePattern: null };
  }
  if (!engine) {
    const imported = await import(new URL("pattern-engine.mjs", patternBase).href);
    engine = imported.createPatternEngine();
  }
  const start = performance.now(), rawSourcePattern = await engine.generate(data.recipe, { assetBase: patternBase }, (progress) => {
    if (token === epoch) emit("runtime", progress);
  });
  const sourcePattern = await recoverExplicitPantsCuffGathering(rawSourcePattern);
  profile.pythonMs = performance.now() - start;
  if (token !== epoch) return;
  const meshStart = performance.now(), paper = compileAnalytic(sourcePattern, { allowUnsupportedSeams: true, numericalStitchSpacingMm: 12, measurementSnapshot: {bodyId:"anny-adult-neutral-r01"} });
  paper.source.bodyId="anny-adult-neutral-r01";
  paper.source.trialBoundary="Original paper, original body, sparse numerical stitching; not calibrated cloth or fit certification. No continuous collision or runtime self-contact response.";
  validate2(paper);
  profile.meshMs = performance.now() - meshStart;
  return { paper, sourcePattern };
}
function packet(type, extra = {}) {
  const start = performance.now(), positionsM = new Float32Array(lab.positions.length * 3);
  for (let i = 0; i < lab.positions.length; i++) positionsM.set(lab.positions[i], i * 3);
  profile.packetMs += performance.now() - start;
  emit(type, { positionsM, metrics: lab.metrics(), frame: lab.frameCount, stage: stages[stageIndex] || "complete", progress: (stages.slice(0,stageIndex).reduce((n,s)=>n+r043Frames(s),0)+stageFrame) / totalFrames, activeWallMs: wallMs + (running ? performance.now() - runStarted : 0), profile: { ...profile }, ...extra }, [positionsM.buffer]);
}
async function startLegacySolve(token) {
 const corrected43=config?.variant43||!new Set(["T01","T02","T03","T04","T08","T15","T16","T17","T18"]).has(nativeBinding?.presetId);
 const spanCorrected43=corrected43&&new Set(["D07","J01","J02","J04","J06","P01","P02","P03","P04","P05","P08","P10","S03","S04","S10","S14"]).has(nativeBinding?.presetId)&&spec.seams.some(s=>s.numericalStitchPlan&&Math.max(s.sourceSeam.lengthAMm,s.sourceSeam.lengthBMm)/Math.min(s.sourceSeam.lengthAMm,s.sourceSeam.lengthBMm)<=1.12+1e-12),kernelMode43=corrected43?(spanCorrected43?'seam-spans':'bending'):'legacy';
 r043PreGuides=r043PreJoint=null;r043BudgetOrigin=0;r043Recovery=[];
 const sizing=preflightSizing(analytic);if(sizing.blocking)throw Error(sizing.message);
  if (config.kind !== "legacy" && !spec.source.experimentalSparseSewing) throw Error("Generate the R06 sparse-stitch material before a new-style trial");
  const directory=config.kind === "legacy"?config.directory:"r06";
  const start = performance.now(), bodyPath = new URL("common-body.json",nativeAssets).href, metaPath = new URL("body-sdf-grid.json",nativeAssets).href;
  if (cachedBodyURL !== bodyPath) {
    body = await nativeJSON(bodyPath,R04_LOCK.bodyFileSHA256);
    if (token !== epoch) return;
    bodyAudit = prepareBodyAudit(body);
    cachedBodyURL = bodyPath;
  }
  if (cachedSDFURL !== metaPath) {
    const meta = await nativeJSON(metaPath,R04_LOCK.sdfMetadataSHA256), raw = await bytes(new URL(meta.transport.file,nativeAssets).href);
    if(await sha(raw)!==R04_LOCK.sdfFileSHA256)throw Error("共同人物碰撞场内容不符");
    const buffer = await decodeSDF(new Blob([raw]), meta);
    if (token !== epoch) return;
    sdf = new BodySDF(meta, new Int16Array(buffer));attachExteriorField(sdf,body);
    cachedSDFURL = metaPath;
  }
  if (!kernelReady || kernelVariant43!==kernelMode43) {
    configureWasm(await bytes(new URL(corrected43?(spanCorrected43?"../../../correctives/r043c/joint-r043c.wasm":"../../../correctives/r043b/joint-r043b.wasm"):"../r07/stability/joint-r072.wasm",import.meta.url).href));kernelVariant43=kernelMode43;
    if (token !== epoch) return;
    kernelReady = true;
  }
  profile.bodyMs = performance.now() - start;
  if(config.kind==="legacy")throw Error("基础款须使用保留的 R06 原始计算线程");
  prepareAssembly(spec,body);prepareShoulderFixtures(spec,sdf);if(corrected43)stageRadialSkirt(spec,analytic,body);
  lab = new GarmentLab2(spec, sdf, { substeps: corrected43&&nativeBinding.presetId==="T06"?18:12, iterations: corrected43&&nativeBinding.presetId==="T06"?4:1, sewingDuration:.75 });
 lab.pipeline43=corrected43;lab.spanCorrected43=spanCorrected43;if(corrected43)configureMaterialBending(lab);if(corrected43)lab.kernel.setBodyExterior43(...sdf.exteriorBounds.lo,...sdf.exteriorBounds.hi);
  lab.orientationGuides = false;
  lab.selfCollisionEnabled = false;
  lab.stitchEqualityElimination = true;
  lab.strainGuard = true;
  stages = [...spec.source.assemblyExperiment,...(corrected43?["seam-relax","seam-finish"]:[]),"release","refine","joint"];
  totalFrames = stages.reduce((n,s)=>n+r043Frames(s),0);
  refinementSteps=0;layerGuide=null;jointSteps=0;jointInfo=closureInfo=null;
  stageIndex = stageFrame = wallMs = 0;
  if (pendingPause) { running=false; packet("paused"); return; }
  running = true;
  runStarted = performance.now();
  packet("started");
  tick(token);
}
// R04.3 sequenced native sewing. Heavy stages yield so pause/cancel remains real.
var r043PreGuides=null,r043PreJoint=null,r043BudgetOrigin=0,r043Recovery=[];
function r043Frames(stage){return ['seam-relax','refine'].includes(stage)?(stage==='seam-relax'?1000:1600):['seam-finish','joint'].includes(stage)?1600:stage==='release'?120:90;}
function tick(token){
 if(!running||token!==epoch)return;
 try{
  const start=performance.now();
  if(wallMs+start-runStarted-r043BudgetOrigin>180000){stop();r043BudgetOrigin=wallMs;packet('paused',{budgetCheckpoint:true,message:'本轮达到180秒计算片段，状态已保留；继续可从当前工序恢复，不会丢弃结果。'});return;}
  let count=0;
  do{
   const stage=stages[stageIndex];
   if(stageFrame===0){
    if(stage==='seam-relax'){lab.kernel.prepare(1/720,lab.elapsed);r043PreGuides=createSeamLayerGuide(lab);for(const v of lab.velocity)v.fill(0);}
    else if(stage==='seam-finish')r043PreJoint=beginMaterialRefinement(lab);
    else if(stage==='release'){
     lab.releasePins();
     if(lab.pipeline43){lab.waistCircuitReport43=waistCircuit(lab,analytic);for(const v of lab.velocity)v.fill(0);lab.setGravity(0);}
     else lab.setGravity(1);
    }else if(stage==='refine'){lab.kernel.prepare(1/720,lab.elapsed);layerGuide=createSeamLayerGuide(lab);for(const v of lab.velocity)v.fill(0);}
    else if(stage==='joint')jointInfo=beginMaterialRefinement(lab);
    else {lab.activate(stage);if(stage==='sides'&&!spec.source.radialAssembly43b?.enabled)lab.releasePins();}
   }
   const time=performance.now();
   if(stage==='refine'||stage==='seam-relax'){
    lab.kernel.globalProject(lab.constraints.length,30,.002,100,50);lab.kernel.vertices(.0035);lab.kernel.surfaces();
    if(lab.waistCircuit43)for(let k=0;k<5;k++){lab.kernel.waistProject43(1);lab.kernel.vertices(.0035);}
    if(stage==='refine'&&stageFrame>=400&&stageFrame<1400)layerGuide.project();
    if(stage==='seam-relax'&&stageFrame<800)r043PreGuides.project();
    if(stage==='refine')refinementSteps++;
   }else if(stage==='joint'||stage==='seam-finish'){
    const result=lab.kernel.qnStep();if(result<0)throw Error('联合整理检测到无效材料/接缝状态；中间坐标保留供诊断。');if(stage==='joint')jointSteps++;
   }else {if(stage==='release'&&lab.pipeline43)lab.setGravity((stageFrame+1)/120);lab.step();}
   profile.solveMs+=performance.now()-time;stageFrame++;count++;
   if(stageFrame===r043Frames(stage)){
    if(stage==='seam-finish')lab.preReleaseClosure43={...jointReport(lab,r043PreJoint),closure:finalizeCloseSeams(lab)};
    if(stage==='joint'){jointInfo=jointReport(lab,jointInfo);closureInfo=finalizeCloseSeams(lab);}
    let check=lab.metrics();
    if(lab.pipeline43&&check.finite&&check.maxPrincipalStrain>5){
     const before=check.maxPrincipalStrain;lab.kernel.prepare(1/720,lab.elapsed);
     for(let j=0;j<160;j++){lab.kernel.globalProject(lab.constraints.length,30,.002,100,50);lab.kernel.vertices(.0035);lab.kernel.surfaces();}
     for(const v of lab.velocity)v.fill(0);check=lab.metrics();r043Recovery.push({stage,beforeMaxStrain:before,afterMaxStrain:check.maxPrincipalStrain,extraGlobalIterations:160});
    }
    if(!check.finite||check.maxPrincipalStrain>5)throw Error('当前原裁片仍存在严重材料变形；已保留有限中间状态，不认定为成衣。');
    packet('stage',{completedStage:stage});stageIndex++;stageFrame=0;
    if(stageIndex===stages.length){
     wallMs+=performance.now()-runStarted;running=false;packet('auditing');
     const begin=performance.now(),record=lab.export(),regions=regionalStrain(spec,record.positionsMm),intersections=strictIntersectionAudit(spec,record.positionsMm,record.materialToSolverGroup,bodyAudit);
     record.nativeBinding=structuredClone(nativeBinding);record.staticGate=staticGate(lab,record,regions,intersections);profile.auditMs=performance.now()-begin;
     record.jointRefinement={...jointInfo,closure:closureInfo};
     record.trial={version:lab.pipeline43?'R04.3-native-material-circuit':'R04.2-preserved-baseline',physicalFitAccepted:false,continuousCollision:false,materialCalibrated:false,runtimeSelfContact:false,originalMaterialRetained:true,wholeSeamGateUnchanged:true};
     record.r043={continuousSeamSpans:lab.seamSpanReport43c||null,bending:lab.bending43b||null,radialAssembly:spec.source.radialAssembly43b||null,surfaceBodySamplesPerTriangle:lab.pipeline43?4:0,sourceRepresentation:analytic.source?.r043SourceRepair||null,waistCircuit:lab.waistCircuitReport43||{enabled:false},preReleaseClosure:lab.preReleaseClosure43||null,adaptiveRecovery:r043Recovery,personScaled:false,displayProxy:false};
     emit('done',{record,regions,intersections,profile,activeWallMs:wallMs+profile.auditMs});return;
    }
   }
  }while(count<8&&performance.now()-start<22);
  if(performance.now()-lastPacket>100){packet('progress');lastPacket=performance.now();}setTimeout(()=>tick(token),0);
 }catch(e){stop();if(lab&&lab.positions.every(p=>Array.from(p).every(Number.isFinite))){packet('checkpoint',{message:e.message,accepted:false,complete:false});}emit('error',{message:e.message});}
}

// This extension is assembled into the inherited worker's module scope by build.py.
import {fromNativeAnalytic,applyPatternEdit} from '../learning/patterngsl-r01/pattern-edit-kernel.mjs';
import {rebuildEditedAnalytic} from '../r07/continuation/native-edit-bridge.mjs';
let continuationBase=null,continuationDocument=null,continuationOperations=[],continuationRevision=0;
function resetContinuation(){continuationBase=continuationDocument=null;continuationOperations=[];continuationRevision=0;}
async function continuationEdit(data){
 requestId=data.requestId;
 if(running)throw Error('先暂停或取消当前缝制，再编辑裁片');
 const restore=data.restore;
 const base=structuredClone(continuationBase||restore?.base||analytic);
 if(!base||base.schema!=='kaopu-analytic-sewing-pattern@1')throw Error('先从原制版程序生成一套真实纸样');
 const proposedConfig=config||restore?.config;if(proposedConfig?.kind!=='analytic')throw Error('仅原生解析纸样支持此编辑事务');
 const operations=structuredClone(continuationBase?continuationOperations:restore?.operations||[]);
 const oldRevision=continuationBase?continuationRevision:restore?.revision||0;
 stop();const token=epoch;
 if(data.type==='edit')operations.push(structuredClone(data.operation));
 else if(data.type==='undo-edit'){if(!operations.length)throw Error('没有可撤销的裁片编辑');operations.pop();}
 else if(data.type==='reset-edits')operations.length=0;
 else if(data.type!=='replay-edits')throw Error('未知裁片事务');
 let document=fromNativeAnalytic(base);
 for(const op of operations)document=applyPatternEdit(document,op).document;
 document.revision=oldRevision+1;
 if(data.type!=='edit')document.editHistory.push({type:data.type,revision:document.revision,remainingOperations:operations.length});
 const next=await rebuildEditedAnalytic(base,document,{operations});if(token!==epoch)return;
 const start=performance.now(),meshed=compileAnalytic(next,{allowUnsupportedSeams:true,numericalStitchSpacingMm:12,measurementSnapshot:{bodyId:'anny-adult-neutral-r01'}});
 meshed.source.bodyId='anny-adult-neutral-r01';meshed.source.continuationEdits=structuredClone(next.source.continuationEdits);
 const placed=new Set(operations.filter(op=>op.type==='translatePlacement').flatMap(op=>op.panelIds));
 meshed.source.continuationExplicitPlacementPanels=document.panels.filter(p=>placed.has(p.id)).map(p=>p.sourcePanelId);
 meshed.source.trialBoundary='Edited source paper with rebuilt lengths, curves, material triangles and explicit seam references; fresh sewing required. Not a fit or motion certificate.';
 validate2(meshed);
 continuationBase=base;continuationDocument=document;continuationOperations=operations;continuationRevision=document.revision;config=proposedConfig;
 spec=meshed;analytic=next;lab=null;profile.meshMs=performance.now()-start;
 const positionsM=initialPositions(spec),fit=preflightSizing(analytic);
 emit('paper',{spec,analytic,positionsM,fingerprint:fingerprint2(spec),topology:topology(spec),profile,
  fitPreflight:fit,canSew:!fit.blocking,editInfo:{revision:continuationRevision,operationCount:operations.length,
   operations:structuredClone(operations),panelIdentities:document.panels.map(p=>({id:p.id,sourcePanelId:p.sourcePanelId,edges:p.edges.map(e=>({id:e.id,kind:e.kind,controlPointsMm:e.controlPointsMm??[]}))})),
   freshMaterialMesh:true,bodyModified:false,oldSolveInvalidated:true},physicalStatus:'Edited paper remeshed; not yet sewn or certified'},[positionsM.buffer]);
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === "boot") {
      root = data.root;
      patternBase = data.patternBase;
      emit("ready", { runtimeLoaded: false });
    } else if(data.type === "generate-native-variant") {
      await generateNativeVariant43(data);
    } else if(data.type === "load-native-paper") {
      await loadNativePaper(data);
    } else if (data.type === "generate") {
      throw Error("本橱柜只接入已记录的原纸样；新量体制版必须走完整原系统，不回退到旧人台。");
      stop();
      requestId = data.requestId;
      config = data.config;
      spec = analytic = lab = null; resetContinuation();
      for (const key in profile) profile[key] = 0;
      const token = epoch, result = await material(config, token);
      if (token !== epoch || !result) return;
      spec = result.paper;
      analytic = result.sourcePattern;
      const positionsM = initialPositions(spec);
      emit("paper", { spec, analytic, positionsM, fingerprint: fingerprint2(spec), topology: topology(spec), profile, fitPreflight:preflightSizing(analytic),canSew: !preflightSizing(analytic).blocking && (config.kind === "legacy" || spec.source.experimentalSparseSewing === true), physicalStatus: config.kind === "legacy" ? "accepted baseline family; current parameters require actual solve" : "R06 live sparse-stitch trial available; no fit certificate" }, [positionsM.buffer]);
    } else if (["edit","undo-edit","reset-edits","replay-edits"].includes(data.type)) {
      throw Error("裁片编辑继续使用保留的原 R07.4；此来源修正版不冒称已接通共同人物重新制版。");
    } else if (data.type === "run") {
      if (!spec) throw Error("Generate the current flat material first");
      requirePerson(data.person,R04_LOCK.person);
      if(!nativeBinding)throw Error("缺少原材料来源绑定");
      if (data.requestId !== requestId) throw Error("Stale paper revision");
      stop();
      pendingPause=false;
      await startLegacySolve(epoch);
    } else if (data.type === "pause") {
      pendingPause=true;
      if (lab) { stop(); packet("paused"); }
    } else if (data.type === "resume") {
      pendingPause=false;
      if (!lab || running || stageIndex >= stages.length) throw Error("No paused solve to resume");
      running = true;
      runStarted = performance.now();
      tick(++epoch);
    } else if (data.type === "invalidate") {
      stop();
      requestId = data.requestId;
      spec = analytic = lab = null; resetContinuation();
      emit("invalidated");
    } else if (data.type === "export") {
      emit("export", { spec, analytic, record: lab?.export() });
    } else if (data.type === "status") {
      emit("status", { runtimeLoaded: !!engine, runtimeStatus: engine?.status(), running, hasPaper: !!spec, workerOwnsPythonAndCloth: true });
    }
  } catch (e) {
    if (data.requestId !== void 0 && data.requestId !== requestId) return;
    stop();
    emit("error", { message: e.message, name: e.name, fatal: !!e.fatal, validation: e.validation, diagnosticPattern: e.diagnosticPattern });
  }
};

// R04_BOUNDED_MATERIAL_SAMPLING_V1
const originalMaterialValidator=validate2;
validate2=function(value){
 try{return originalMaterialValidator(value)}catch(error){
  // Enrich an error, never turn failed validation into success.
  const code=String(error.message||'');
  if(code.startsWith('MATERIAL_COORDINATES: ')){
   const id=code.slice('MATERIAL_COORDINATES: '.length),p=value.panels.find(p=>p.id===id);
   if(p&&Array.isArray(p.uvMm)&&p.uvMm.length>3000&&p.uvMm.every(x=>finite2(x)&&x.every(v=>Math.abs(v)<=2000))){
    error.nativeVertexBudget={panelId:id,count:p.uvMm.length,limit:3000,boundaryCount:p.boundary.length};
   }
  }
  throw error;
 }
};
function compileWithinNativeBudget(input,options){
 const attempts=[];
 for(const step of [16,18,20,22,24,28,32]){
  try{
   const result=compileAnalytic(input,{...options,interiorStepMm:step});
   result.source.meshing.budgetPolicy={schema:'kaopu-native-mesh-budget@1',attempts,selectedInteriorStepMm:step,originalDefaultInteriorStepMm:16,boundarySamplingChanged:false,chordToleranceMm:.25,numericalStitchSpacingMm:12,validatorBudgetRaised:false,physicalQualityThresholdsChanged:false};
   return result;
  }catch(error){
   if(!error.nativeVertexBudget||error.nativeVertexBudget.boundaryCount>=3000)throw error;
   attempts.push({interiorStepMm:step,...error.nativeVertexBudget});
  }
 }
 throw Error('NATIVE_MESH_BUDGET_EXHAUSTED: original validator retained; no substitute garment.');
}

var kernelVariant43=null;
async function generateNativeVariant43(data){
 stop();requestId=data.requestId;nativeBinding=null;spec=analytic=lab=null;resetContinuation();requirePerson(data.person,R04_LOCK.person);
 const row=R04_ROWS[data.presetId];if(!row||await sha(data.paperText)!==row.decodedSHA256)throw Error('参数变体必须从该款已冻结的原纸样派生。');
 const original=JSON.parse(data.paperText),token=epoch,parameters=data.parameters||{},easeCm=data.easeCm??0,waistEaseCm=data.waistEaseCm??0;
 const schema=await json(new URL('../../../parameter-schema.json',import.meta.url).href),byPath=new Map(schema.parameters.map(p=>[p.path,p]));
 if(!Number.isFinite(easeCm)||easeCm<0||easeCm>12)throw Error('试穿松量支持0至12厘米；不是无限制放大模型。');
 if(!Number.isFinite(waistEaseCm)||waistEaseCm<0||waistEaseCm>6)throw Error('腰头加放量支持0至6厘米，增大时需另验支承。');
 const design=structuredClone(original.design),changes=[];
 for(const[path,value]of Object.entries(parameters)){
  const rule=byPath.get(path);if(!rule)throw Error('未知原生参数：'+path);
  if(rule.type==='bool'&&typeof value!=='boolean')throw Error('布尔参数类型不符：'+path);
  if(rule.type==='int'||rule.type==='float'){if(!Number.isFinite(value)||(rule.type==='int'&&!Number.isInteger(value))||value<Math.min(...rule.samplingRange)||value>Math.max(...rule.samplingRange))throw Error('超出原制版参数范围：'+path);}
  if(rule.choices&&!rule.choices.some(v=>v===value))throw Error('原程序不支持该选项：'+path);
  let at=design;const keys=path.split('.');for(const k of keys.slice(0,-1))at=at[k];const old=at[keys.at(-1)].v;at[keys.at(-1)].v=value;if(old!==value)changes.push({path,from:old,to:value});
 }
 const patternBodyCm=structuredClone(original.bodyCm),sizing=[];
 // Positive ease changes only garment drafting dimensions, not the displayed/colliding person.
 for(const[key,back,extra]of[['bust','back_width',easeCm],['waist','waist_back_width',waistEaseCm],['hips','hip_back_width',easeCm]])if(extra){const before=patternBodyCm[key],ratio=(before+extra)/before;patternBodyCm[key]+=extra;if(Number.isFinite(patternBodyCm[back]))patternBodyCm[back]*=ratio;sizing.push({measurement:key,fromCm:before,toCm:patternBodyCm[key],classification:'garment-drafting-ease-not-person-measurement'});}
 if(!engine){const imported=await import(new URL('pattern-engine.mjs',patternBase).href);engine=imported.createPatternEngine();}
 const paramsHash=await sha(stable43({parameters,easeCm,waistEaseCm}));
 for(const k in profile)profile[k]=0;
 const start=performance.now(),generated=await engine.generate({bodyCm:patternBodyCm,design:{style:row.style,...design},validateIntersections:true},{assetBase:patternBase},p=>{if(token===epoch)emit('runtime',p)});
 if(token!==epoch)return;profile.pythonMs=performance.now()-start;
 const originalRuntime=await engine.generate({bodyCm:original.bodyCm,design:{style:row.style,...original.design},validateIntersections:true},{assetBase:patternBase});
 if(token!==epoch)return;
 const sameGeometry=await cuttingGeometryHash43(generated)===await cuttingGeometryHash43(originalRuntime);
 if(sameGeometry){emit('parameter-inactive',{presetId:row.id,parameterRequestSHA256:paramsHash,changes,geometryChanged:false,message:'本次参数在当前领型、袖型或版式条件下没有改变裁片；未冒充调节生效。'});return;}
 analytic=await recoverExplicitPantsCuffGathering(prepareNativeSource(generated));
 config={kind:'analytic',variant43:true,recipe:{bodyCm:patternBodyCm,design:{style:row.style,...design}}};
 spec=compileWithinNativeBudget(analytic,{allowUnsupportedSeams:true,numericalStitchSpacingMm:12,measurementSnapshot:{bodyId:'common-native-default-r04',sizingOrigin:'explicit-source-parameter-variant'}});validate2(spec);
 nativeBinding={person:structuredClone(R04_LOCK.person),presetId:row.id,basePresetId:row.id,recipeHash:generated.recipeHash,paperSHA256:await sha(JSON.stringify(generated)),basePaperSHA256:row.decodedSHA256,materialSHA256:await materialHash(spec),nativeAnchor:R04_LOCK.nativeAnchor,patternSizingOrigin:'EXPLICIT_GENERATED_GARMENT_VARIANT_NOT_CHANGED_PERSON',parameterRequestSHA256:paramsHash,parameters:structuredClone(parameters),easeCm,waistEaseCm,changes,sizing};
 spec.source.nativeBinding=structuredClone(nativeBinding);spec.source.bodyId='common-native-default-r04';spec.source.patternSizingOrigin=nativeBinding.patternSizingOrigin;
 const positionsM=initialPositions(spec),fit=preflightSizing(analytic);emit('paper',{spec,analytic,positionsM,variant:true,geometryChanged:true,binding:nativeBinding,fitPreflight:fit,canSew:!fit.blocking,physicalStatus:'原制版程序生成了实际新裁片；需重新缝合，不沿用旧成衣。'},[positionsM.buffer]);
}
const stable43=x=>JSON.stringify(x&&typeof x==='object'?Array.isArray(x)?x.map(v=>JSON.parse(stable43(v))):Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(stable43(x[k]))])):x);
async function cuttingGeometryHash43(d){return sha(stable43(d.panels.map(p=>({id:p.id,verticesMm:p.verticesMm,edges:p.edges,placement:p.placement}))));}
