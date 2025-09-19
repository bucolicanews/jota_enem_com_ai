export interface PermissionStyle {
  color: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
}

export const getPermissionStyle = (permissionName: string): PermissionStyle => {
  const normalizedName = permissionName.toLowerCase();
  
  switch (normalizedName) {
    case 'admin':
      return {
        color: 'text-amber-900',
        bgColor: 'bg-amber-100',
        borderColor: 'border-amber-300',
        iconColor: 'text-amber-600'
      };
       
    case 'prof':
      return {
        color: 'text-purple-900',
        bgColor: 'bg-purple-100',
        borderColor: 'border-purple-300',
        iconColor: 'text-purple-600'
      };
    
    
    case 'pro':
      return {
        color: 'text-indigo-900',
        bgColor: 'bg-indigo-100',
        borderColor: 'border-indigo-300',
        iconColor: 'text-indigo-600'
      };
   
    case 'free':
    default:
      return {
        color: 'text-gray-900',
        bgColor: 'bg-green-100',
        borderColor: 'border-gray-300',
        iconColor: 'text-gray-600'
      };
  }
};