<script>
    // Import the CJR styles
    import './cjr.css';
    
    // Logo configuration - update these URLs to change the logo
    const logoDesktopUrl = 'https://miro.medium.com/v2/resize:fit:1070/1*Bdt1nEsNDbLfk-w0b3dnqA.jpeg';
    const logoMobileUrl = 'https://miro.medium.com/v2/resize:fit:1070/1*Bdt1nEsNDbLfk-w0b3dnqA.jpeg';
    const logoAlt = 'Columbia Journalism School and Tow Center for Digital Journalism';
    const logoLink = 'https://towcenter.columbia.edu/';

    /**
     * @typedef {Object} NavItem
     * @property {string} href - Link anchor
     * @property {string} label - Link text
     */

    /** @type {{ navItems?: NavItem[] }} */
    let {
        navItems = []
    } = $props();
</script>


<div class="container-fluid top-nav-box">
    <div class="container-lg top-nav-1">
        <header class="cjr-header">
            <a class="cjr-header__logo-link" href={logoLink} rel="home" data-umami-event="header-logo-click">
                <img
                    src={logoDesktopUrl}
                    alt={logoAlt}
                    class="cjr-header__logo"
                />
                <img
                    src={logoMobileUrl}
                    alt={logoAlt}
                    class="cjr-logo-mobile"
                />
            </a>
            <a href="https://towcenter.columbia.edu/content/stay-updated-about-tow-centers-work-how-technology-changing-journalism-subscribe-our-weekly" class="subscribe-button" data-umami-event="header-stay-updated-click">Stay Updated</a>
        </header>
    </div>
</div>
<style>
    .cjr-header__logo-link {
        display: flex;
        align-items: center;
        text-decoration: none;
        line-height: 0;
        width: auto;
        height: 100%;
    }
    
    .cjr-header__logo-link img.cjr-header__logo {
        max-width: 500px;
        width: auto !important;
        height: auto;
        max-height: 70px;
        object-fit: contain;
        display: block;
    }
    
    .cjr-header__logo-link img.cjr-logo-mobile {
        max-width: 100%;
        width: auto !important;
        height: auto;
        object-fit: contain;
        display: none;
    }
    
    .subscribe-button {
        display: block;
        padding: 0.6rem 1.5rem;
        background-color: #999999;
        color: white;
        text-decoration: none;
        border: none;
        border-radius: 0;
        font-family: 'Graphik Web', 'Helvetica', sans-serif;
        font-size: 0.95rem;
        font-weight: 500;
        white-space: nowrap;
        margin-left: auto;
        transition: background-color 0.2s ease;
    }

    .subscribe-button:hover {
        background-color: #777777;
        color: white;
        text-decoration: none;
    }


    .top-nav-1 {
        padding-left: 1rem;
        padding-right: 1rem;
    }

    @media screen and (max-width: 767px) {
        .top-nav-1 {
            padding-left: 1rem;
            padding-right: 1rem;
        }
        .cjr-header__logo-link img.cjr-header__logo {
            display: none;
        }
        
        .cjr-header__logo-link img.cjr-logo-mobile {
            display: block !important;
            max-height: 60px;
            width: auto !important;
            max-width: 100%;
        }

        .subscribe-button {
            display: none;
        }
    }
    @media screen and (min-width: 768px) and (max-width: 1024px) {
        .top-nav-1 {
            padding-left: 1.5rem;
            padding-right: 1.5rem;
        }
    }
</style>    
