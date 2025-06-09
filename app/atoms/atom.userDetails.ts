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
    deposit_price: 0,
    deposit_charge:0,
    guestUserId : '',
})


export default userDetailsAtom;


