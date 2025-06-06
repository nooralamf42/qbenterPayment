import {atom} from  'jotai'


const userDetailsAtom = atom({
    firstName : '',
    lastName : '',
    email : '',
    password : '',
    companyName: '',
    phone : '',
    address : '',
    city : '',
    state : '',
    zipCode : '',
})


export default userDetailsAtom;


